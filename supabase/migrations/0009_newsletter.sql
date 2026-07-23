-- Newsletter subscriptions. Unlike orders, a subscriber email carries no
-- pricing/stock risk, so anon can INSERT directly (no RPC needed) — but anon
-- gets no SELECT policy at all, since a blanket read policy would let anyone
-- dump the whole email list via the REST API.

create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 200 and email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index newsletter_subscribers_email_idx on newsletter_subscribers (lower(email));

alter table newsletter_subscribers enable row level security;

create policy newsletter_subscribers_anon_insert on newsletter_subscribers
  for insert to anon with check (true);
create policy newsletter_subscribers_admin_all on newsletter_subscribers
  for all to authenticated using (true) with check (true);
