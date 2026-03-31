-- ─── Hybrid search function (Reciprocal Rank Fusion) ─────────────────────────
-- Note: tsvector is computed inline (to_tsvector('english', content)) rather than
-- stored as a generated column, avoiding maintenance_work_mem constraints on free tier.
-- A GIN index can be added later on an upgraded plan for large-scale performance.
-- RRF combines semantic and keyword rankings without requiring score normalization.
-- Formula: score = 1/(k + rank_semantic) + 1/(k + rank_keyword)
-- k=60 is the standard constant — dampens the effect of very high rankings.
--
-- Why RRF over weighted sum:
--   - Scores from different systems are not on the same scale
--   - RRF only needs rank order, not raw scores — more robust
--   - Naturally rewards chunks that appear in both result sets

drop function if exists hybrid_search(text, vector, int, text, int);

create or replace function hybrid_search(
  query_text      text,
  query_embedding vector(1024),
  match_count     int  default 5,
  filter_layer    text default null,
  rrf_k           int  default 60
)
returns table (
  id           uuid,
  document_id  uuid,
  chunk_index  integer,
  content      text,
  token_count  integer,
  metadata     jsonb,
  similarity   float
)
language plpgsql
as $$
begin
  return query
  with
    -- Semantic search: top 20 by vector cosine distance
    semantic as (
      select
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.content,
        dc.token_count,
        dc.metadata,
        row_number() over (
          order by dc.embedding <=> query_embedding
        ) as rank
      from document_chunks dc
      join documents d on dc.document_id = d.id
      where (filter_layer is null or d.layer = filter_layer)
      order by dc.embedding <=> query_embedding
      limit 20
    ),

    -- Keyword search: top 20 by full-text rank
    -- websearch_to_tsquery handles natural language ("brand strategy" → brand & strategy)
    keyword as (
      select
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.content,
        dc.token_count,
        dc.metadata,
        row_number() over (
          order by ts_rank_cd(to_tsvector('english', dc.content), websearch_to_tsquery('english', query_text)) desc
        ) as rank
      from document_chunks dc
      join documents d on dc.document_id = d.id
      where
        (filter_layer is null or d.layer = filter_layer)
        and to_tsvector('english', dc.content) @@ websearch_to_tsquery('english', query_text)
      order by ts_rank_cd(to_tsvector('english', dc.content), websearch_to_tsquery('english', query_text)) desc
      limit 20
    ),

    -- RRF fusion: full outer join so chunks from either set are included
    fused as (
      select
        coalesce(s.id,           k.id)           as id,
        coalesce(s.document_id,  k.document_id)  as document_id,
        coalesce(s.chunk_index,  k.chunk_index)  as chunk_index,
        coalesce(s.content,      k.content)      as content,
        coalesce(s.token_count,  k.token_count)  as token_count,
        coalesce(s.metadata,     k.metadata)     as metadata,
        coalesce(1.0 / (rrf_k + s.rank), 0.0)
          + coalesce(1.0 / (rrf_k + k.rank), 0.0) as score
      from semantic s
      full outer join keyword k on s.id = k.id
    )

  select
    id, document_id, chunk_index, content, token_count, metadata,
    score as similarity
  from fused
  order by score desc
  limit match_count;
end;
$$;
