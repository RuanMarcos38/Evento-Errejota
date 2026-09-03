create table public.erj_ai_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.erj_tenants(id) on delete cascade,
  name text not null default 'Agente Errejota',
  enabled boolean not null default true,
  model text not null default 'gpt-5.6-luna',
  instructions text not null default 'Você é o agente virtual do Errejota Bar. Responda em português do Brasil, em mensagens curtas e humanas. Faça no máximo uma pergunta por resposta. Ajude com informações de eventos, reservas e dúvidas usando apenas dados disponíveis no sistema. Não invente preços, disponibilidade, endereço, condições ou políticas. Se a informação não estiver disponível ou se o cliente pedir atendimento humano, encaminhe para um atendente. Nunca prometa reserva confirmada sem registro no sistema. Respeite opt-out e não envie marketing não solicitado.',
  handoff_keywords text[] not null default array['humano','atendente','pessoa','gerente','falar com alguém','falar com alguem'],
  max_history_messages integer not null default 20 check (max_history_messages between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.erj_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.erj_tenants(id) on delete cascade,
  provider text not null check (provider in ('whatsapp','instagram')),
  external_event_id text,
  external_account_id text,
  event_type text not null default 'message',
  status text not null default 'received' check (status in ('received','processed','ignored','error')),
  payload jsonb not null default '{}'::jsonb,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.erj_conversations
  add column ai_enabled boolean not null default true,
  add column human_handoff boolean not null default false,
  add column last_ai_response_id text,
  add column last_ai_at timestamptz,
  add column last_customer_message_at timestamptz;

create unique index erj_messages_provider_message_uq
  on public.erj_messages(tenant_id, provider_message_id)
  where provider_message_id is not null;

create unique index erj_integrations_provider_external_account_uq
  on public.erj_integrations(provider, external_account_id)
  where external_account_id is not null;

create unique index erj_webhook_events_provider_external_event_uq
  on public.erj_webhook_events(provider, external_event_id)
  where external_event_id is not null;

create index erj_webhook_events_tenant_received_idx
  on public.erj_webhook_events(tenant_id, received_at desc);

create index erj_ai_agents_tenant_enabled_idx
  on public.erj_ai_agents(tenant_id, enabled);

alter table public.erj_ai_agents enable row level security;
alter table public.erj_webhook_events enable row level security;

create policy erj_ai_agents_select
on public.erj_ai_agents
for select
to authenticated
using (private.erj_is_member(tenant_id, (select auth.uid())));

create policy erj_ai_agents_manage
on public.erj_ai_agents
for all
to authenticated
using (private.erj_can_manage(tenant_id, (select auth.uid())))
with check (private.erj_can_manage(tenant_id, (select auth.uid())));

create policy erj_webhook_events_select
on public.erj_webhook_events
for select
to authenticated
using (private.erj_can_manage(tenant_id, (select auth.uid())));

revoke all on public.erj_ai_agents from anon;
revoke all on public.erj_webhook_events from anon;
revoke all on public.erj_webhook_events from authenticated;
grant select, insert, update, delete on public.erj_ai_agents to authenticated;
grant select on public.erj_webhook_events to authenticated;

create or replace function private.erj_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.erj_touch_updated_at() from public;

create trigger erj_ai_agents_touch_updated_at
before update on public.erj_ai_agents
for each row execute function private.erj_touch_updated_at();

create or replace function public.erj_bootstrap_tenant(p_name text default 'Errejota')
returns uuid
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  v_user uuid := auth.uid();
  v_tenant uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  select tenant_id into v_tenant
  from public.erj_members
  where user_id = v_user
  order by created_at
  limit 1;

  if v_tenant is null then
    v_slug := regexp_replace(lower(coalesce(nullif(trim(p_name), ''), 'errejota')), '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug) || '-' || substr(replace(v_user::text, '-', ''), 1, 8);

    insert into public.erj_tenants(name, slug)
    values (coalesce(nullif(trim(p_name), ''), 'Errejota'), v_slug)
    returning id into v_tenant;

    insert into public.erj_members(tenant_id, user_id, role)
    values (v_tenant, v_user, 'owner');
  end if;

  insert into public.erj_integrations(tenant_id, provider, status, config)
  values
    (v_tenant, 'whatsapp', 'disconnected', jsonb_build_object('mode','cloud_api','webhook','meta-webhook')),
    (v_tenant, 'instagram', 'disconnected', jsonb_build_object('mode','messaging_api','webhook','meta-webhook')),
    (v_tenant, 'openai', 'disconnected', jsonb_build_object('model','gpt-5.6-luna','store',false))
  on conflict (tenant_id, provider) do nothing;

  insert into public.erj_ai_agents(tenant_id)
  values (v_tenant)
  on conflict (tenant_id) do nothing;

  return v_tenant;
end;
$$;

revoke all on function public.erj_bootstrap_tenant(text) from public;
revoke all on function public.erj_bootstrap_tenant(text) from anon;
grant execute on function public.erj_bootstrap_tenant(text) to authenticated;
