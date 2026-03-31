-- Atlas Knowledge Layer Schema
-- Requires pgvector extension

create extension if not exists vector;

-- Documents table — one row per ingested document
create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  layer text not null check (layer in ('core', 'frameworks', 'clients', 'market', 'live')),
  source_path text not null,
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Document chunks — split documents with embeddings
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1024), -- voyage-3 dimension
  token_count integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_chunks_document on document_chunks(document_id);
create index idx_chunks_embedding on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index idx_documents_layer on documents(layer);

-- Similarity search function
create or replace function match_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  filter_layer text default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index integer,
  content text,
  token_count integer,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.token_count,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on dc.document_id = d.id
  where (filter_layer is null or d.layer = filter_layer)
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
