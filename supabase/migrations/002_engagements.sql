create table engagements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  url text,
  brief text,
  notes text,
  competitive_set text[] not null default '{}',
  status text not null default 'intake'
    check (status in ('intake', 'diagnosing', 'active', 'archived')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_engagements_status on engagements(status);
create index idx_engagements_created on engagements(created_at desc);

-- Link document chunks to engagements (optional context loading)
alter table document_chunks
  add column if not exists engagement_id uuid references engagements(id) on delete set null;
