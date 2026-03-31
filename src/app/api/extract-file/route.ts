import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Allow larger bodies for PDF/Office docs
export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stemName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });

  const texts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("string");
    // Pull text nodes from <a:t> elements, preserve spacing
    const text = xml
      .replace(/<a:br\s*\/>/g, "\n")
      .replace(/<\/a:p>/g, "\n")
      .replace(/<a:t[^>]*>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
    if (text) texts.push(text);
  }

  return texts.join("\n\n---\n\n");
}

async function extractFromGoogleDriveUrl(
  url: string
): Promise<{ title: string; text: string; type: string } | null> {
  // Google Docs
  const docMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch) {
    const exportUrl = `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`;
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const text = await res.text();
    return { title: "Google Doc", text: text.trim(), type: "google-doc" };
  }

  // Google Sheets
  const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch) {
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`;
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const text = await res.text();
    return { title: "Google Sheet", text: text.trim(), type: "google-sheet" };
  }

  // Google Slides — export as plain text isn't perfect but pulls speaker notes + titles
  const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slidesMatch) {
    const exportUrl = `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`;
    const res = await fetch(exportUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const text = await res.text();
    return { title: "Google Slides", text: text.trim(), type: "google-slides" };
  }

  return null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let buffer: Buffer | null = null;
  let filename = "document";
  let ext = "";
  let mimeType = "";

  // ── Parse input ─────────────────────────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    // URL-only submission (Google Drive etc.)
    const urlField = formData.get("url");
    if (typeof urlField === "string" && urlField.trim()) {
      const result = await extractFromGoogleDriveUrl(urlField.trim());
      if (result) return NextResponse.json(result);
      return NextResponse.json(
        { error: "Could not access that URL. For Google Drive, make sure sharing is set to 'Anyone with the link'." },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large — maximum is 20 MB" }, { status: 413 });
    }

    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name;
    mimeType = file.type;
    ext = filename.split(".").pop()?.toLowerCase() ?? "";
  } else {
    // JSON body with URL
    const body = await request.json().catch(() => null);
    if (body?.url) {
      const result = await extractFromGoogleDriveUrl(body.url);
      if (result) return NextResponse.json(result);
      return NextResponse.json(
        { error: "Could not access that URL. For Google Drive, make sure sharing is set to 'Anyone with the link'." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "No file or URL provided" }, { status: 400 });
  }

  if (!buffer) {
    return NextResponse.json({ error: "No file data received" }, { status: 400 });
  }

  const title = stemName(filename);

  // ── Extract ──────────────────────────────────────────────────────────────────
  try {
    let text = "";

    // ── PDF ───────────────────────────────────────────────────────────────────
    // pdf-parse v2 uses a class-based API: new PDFParse({ data }) → .getText()
    if (ext === "pdf" || mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      text = result.text.trim();
    }

    // ── Word (modern) ─────────────────────────────────────────────────────────
    else if (
      ext === "docx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value.trim();
    }

    // ── Word (legacy) — best-effort via DOCX-like ZIP extraction ─────────────
    else if (ext === "doc" || mimeType === "application/msword") {
      // .doc is a binary format we can't reliably parse without LibreOffice.
      // Return a clear message rather than garbled output.
      return NextResponse.json(
        { error: "Legacy .doc files aren't supported — please save as .docx and try again." },
        { status: 400 }
      );
    }

    // ── Excel ─────────────────────────────────────────────────────────────────
    else if (
      ext === "xlsx" ||
      ext === "xls" ||
      ext === "csv" ||
      mimeType.includes("spreadsheet") ||
      mimeType === "text/csv"
    ) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const parts = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet).trim();
        return workbook.SheetNames.length > 1 ? `## ${sheetName}\n${csv}` : csv;
      });
      text = parts.join("\n\n");
    }

    // ── PowerPoint ────────────────────────────────────────────────────────────
    else if (
      ext === "pptx" ||
      mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      text = await extractPptxText(buffer);
    }

    else if (ext === "ppt") {
      return NextResponse.json(
        { error: "Legacy .ppt files aren't supported — please save as .pptx and try again." },
        { status: 400 }
      );
    }

    // ── Plain text / Markdown ─────────────────────────────────────────────────
    else if (
      ext === "txt" ||
      ext === "md" ||
      ext === "markdown" ||
      mimeType.startsWith("text/")
    ) {
      text = buffer.toString("utf-8").trim();
    }

    // ── Unsupported ───────────────────────────────────────────────────────────
    else {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext || "unknown"}` },
        { status: 400 }
      );
    }

    if (!text) {
      return NextResponse.json(
        { error: "No text could be extracted from this file." },
        { status: 422 }
      );
    }

    return NextResponse.json({ title, text, type: ext || "txt" });
  } catch (err) {
    console.error("[extract-file]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
