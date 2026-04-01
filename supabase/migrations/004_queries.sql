create table queries (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references engagements(id) on delete set null,
  query text not null,
  mode text not null default 'DIAGNOSIS',
  answer text not null,
  sources jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index idx_queries_engagement on queries(engagement_id);
create index idx_queries_created on queries(created_at desc);
