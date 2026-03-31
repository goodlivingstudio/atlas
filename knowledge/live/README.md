# Live Layer

API-connected sources. These are called at query time — not stored in the vector database. They provide real-time signal that complements the static knowledge base.

## Planned integrations

*Audience and social:*
- **Google Trends** — free, real-time search interest
- **Reddit API** — raw audience signal, conversation analysis
- **SparkToro** — audience attention mapping (paid)
- **YouGov** — polling and brand perception (paid)

*Market and economic:*
- **FRED** — Federal Reserve economic data (free API)
- **US Census Bureau** — demographic data (free)
- **SEC EDGAR** — competitor financials (free)
- **Bureau of Labor Statistics** — employment and wage data (free)

*Competitive and web:*
- **Firecrawl** — web scraping for competitor content
- **SimilarWeb** — web traffic and audience data (limited free tier)

## Architecture note
Live sources are middleware — called between retrieval and synthesis. They augment retrieved knowledge base content with current data. They do not create embeddings or persist to Supabase.

Each integration will live at `src/lib/live/[source].ts` and expose a standard interface:
```typescript
interface LiveSource {
  query(params: LiveQueryParams): Promise<LiveResult>
}
```

## Build order (planned)
1. Google Trends — highest signal/effort ratio, free
2. FRED — economic context, free
3. Reddit — audience signal, free tier available
4. Firecrawl — competitive scraping
