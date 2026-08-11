create extension if not exists pgcrypto;

create table if not exists agents (
  id text primary key,
  email text,
  full_name text,
  code text,
  role text default 'agent',
  store_name text,
  commission_rate numeric default 10,
  active boolean default true,
  phone text,
  region text,
  status text default 'active',
  notes text,
  created_at timestamptz default now(),
  created_date timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  agent_id text references agents(id) on delete cascade,
  agent_name text,
  agent_email text,
  recipient_number text,
  customer_name text,
  package_name text,
  amount numeric default 0,
  status text default 'pending',
  source text default 'store',
  network text,
  volume_gb numeric default 0,
  payment_method text,
  reference text,
  code text,
  evidence_url text,
  archived boolean default false,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists reports (
  id text primary key,
  agent_id text references agents(id) on delete cascade,
  order_id text,
  recipient_number text,
  package_name text,
  reason text,
  details text,
  status text default 'open',
  resolution text,
  evidence_url text,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists packages (
  id text primary key,
  code text,
  name text,
  network text,
  volume_gb numeric default 0,
  price numeric default 0,
  agent_price numeric default 0,
  validity text,
  active boolean default true,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists wallet_transactions (
  id text primary key,
  agent_id text references agents(id) on delete cascade,
  agent_name text,
  type text,
  amount numeric default 0,
  notes text,
  balance_after numeric default 0,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists agent_wallets (
  id text primary key,
  agent_id text references agents(id) on delete cascade,
  agent_name text,
  balance numeric default 0,
  api_key text,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists withdrawals (
  id text primary key,
  agent_id text references agents(id) on delete cascade,
  amount numeric default 0,
  method text,
  account_info text,
  status text default 'pending',
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists notifications (
  id text primary key,
  title text,
  message text,
  type text default 'info',
  active boolean default true,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id text primary key,
  agent_id text references agents(id) on delete cascade,
  agent_name text,
  agent_email text,
  sender text,
  message text,
  file_url text,
  file_name text,
  read boolean default false,
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists settings (
  id text primary key,
  key text unique,
  value text,
  label text,
  created_at timestamptz default now()
);

alter table agents enable row level security;
alter table orders enable row level security;
alter table reports enable row level security;
alter table packages enable row level security;
alter table wallet_transactions enable row level security;
alter table agent_wallets enable row level security;
alter table withdrawals enable row level security;
alter table notifications enable row level security;
alter table chat_messages enable row level security;
alter table settings enable row level security;

drop policy if exists "Allow all access to agents" on agents;
drop policy if exists "Allow all access to orders" on orders;
drop policy if exists "Allow all access to reports" on reports;
drop policy if exists "Allow all access to packages" on packages;
drop policy if exists "Allow all access to wallet_transactions" on wallet_transactions;
drop policy if exists "Allow all access to agent_wallets" on agent_wallets;
drop policy if exists "Allow all access to withdrawals" on withdrawals;
drop policy if exists "Allow all access to notifications" on notifications;
drop policy if exists "Allow all access to chat_messages" on chat_messages;
drop policy if exists "Allow all access to settings" on settings;

create policy "Allow all access to agents" on agents for all using (true) with check (true);
create policy "Allow all access to orders" on orders for all using (true) with check (true);
create policy "Allow all access to reports" on reports for all using (true) with check (true);
create policy "Allow all access to packages" on packages for all using (true) with check (true);
create policy "Allow all access to wallet_transactions" on wallet_transactions for all using (true) with check (true);
create policy "Allow all access to agent_wallets" on agent_wallets for all using (true) with check (true);
create policy "Allow all access to withdrawals" on withdrawals for all using (true) with check (true);
create policy "Allow all access to notifications" on notifications for all using (true) with check (true);
create policy "Allow all access to chat_messages" on chat_messages for all using (true) with check (true);
create policy "Allow all access to settings" on settings for all using (true) with check (true);
