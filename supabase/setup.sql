-- ============================================================================
-- BANCO NOSSA SENHORA DA CONCEIÇÃO — SETUP COMPLETO DO SUPABASE (v2)
-- Banco de dados REAL: cadastro e login passam a usar auth.users (Supabase
-- Auth) + tabelas públicas com Row Level Security.
--
-- COMO USAR: Dashboard do Supabase → ícone SQL (SQL Editor) → New query →
-- cole TODO este arquivo → Run.
-- ============================================================================

-- ============================================================
-- 1. HELPERS
-- ============================================================

-- Verifica se o usuário logado é administrador (security definer:
-- lê profiles sem depender de RLS)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Gera um ID de transação no mesmo formato usado pelo app (TX-XXXX...)
create or replace function public.gerar_id_tx()
returns text
language sql volatile
as $$
  select 'TX-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
$$;

-- ============================================================
-- 2. TABELAS
-- ============================================================

-- PERFIS — 1 para 1 com auth.users (o SUPABASE AUTH guarda o e-mail e o
-- HASH DA SENHA — nunca em texto puro, nunca no frontend)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nome_completo text not null,
  telefone text not null default '',
  data_nascimento date,
  endereco text not null default '',
  bairro text not null default '',
  balance bigint not null default 162000,      -- centavos; começa com R$ 1.620,00
  role text not null default 'user',
  blocked boolean not null default false,
  pix_keys jsonb not null default '[]',
  last_salary_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- TRANSAÇÕES — extrato de todos os usuários
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  category text not null,
  description text not null,
  amount bigint not null check (amount > 0),
  direction text not null check (direction in ('in','out')),
  balance_after bigint not null,
  status text not null default 'concluida',
  sender_name text,
  receiver_name text,
  pix_key text,
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- COBRANÇAS (taxas/impostos do bairro)
create table if not exists public.fees (
  id text primary key,
  description text not null,
  amount bigint not null check (amount > 0),
  due_date date not null,
  bairro text not null default '',
  status text not null default 'pendente' check (status in ('pendente','paga','cancelada')),
  paid_by uuid references public.profiles(id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- BOLETOS FICTÍCIOS
create table if not exists public.boletos (
  code text primary key,
  beneficiary text not null,
  amount bigint not null check (amount > 0),
  due_date date not null,
  description text not null default '',
  status text not null default 'aberto' check (status in ('aberto','pago','vencido'))
);

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles     enable row level security;
alter table public.transactions enable row level security;
alter table public.fees         enable row level security;
alter table public.boletos      enable row level security;

-- PERFIS: usuário vê/edita os próprios dados; admin vê/edita todos
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- TRANSAÇÕES: usuário vê apenas as próprias; admin vê todas.
-- (Inserção financeira do usuário comum acontece SOMENTE pelas funções
-- RPC security definer abaixo — nunca direto no cliente.)
create policy "transactions_select" on public.transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "transactions_insert_admin" on public.transactions
  for insert to authenticated
  with check (public.is_admin());

-- COBRANÇAS: todos autenticados leem; só admin cria/edita/cancela
create policy "fees_select" on public.fees
  for select to authenticated using (true);

create policy "fees_write_admin" on public.fees
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- BOLETOS: todos autenticados leem; só admin edita (pagamento é via RPC)
create policy "boletos_select" on public.boletos
  for select to authenticated using (true);

create policy "boletos_write_admin" on public.boletos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 4. CRIAÇÃO AUTOMÁTICA DE PERFIL NO CADASTRO
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_telefone text := '+55' || regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g');
begin
  insert into public.profiles (id, username, nome_completo, telefone, data_nascimento, endereco, bairro, pix_keys)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'nome_completo',
    v_telefone,
    nullif(new.raw_user_meta_data->>'data_nascimento', '')::date,
    coalesce(new.raw_user_meta_data->>'endereco', ''),
    coalesce(new.raw_user_meta_data->>'bairro', ''),
    jsonb_build_array(
      jsonb_build_object('value', lower(new.email), 'type', 'email', 'label', 'E-mail (cadastro)', 'createdAt', extract(epoch from now())*1000),
      case when length(regexp_replace(v_telefone, '\D', '', 'g')) >= 10
        then jsonb_build_object('value', v_telefone, 'type', 'telefone', 'label', 'Telefone (cadastro)', 'createdAt', extract(epoch from now())*1000)
        else null end
    ) - 'null'::jsonb
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Proteções no perfil: usuário comum não pode alterar saldo, role ou blocked
-- direto pelo console do navegador (só admin ou funções RPC)
create or replace function public.protect_profile()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.balance <> old.balance or new.role <> old.role or new.blocked <> old.blocked)
     and not public.is_admin() then
    raise exception 'Operação não permitida: saldo, papel e bloqueio só mudam via sistema ou admin.';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_trigger on public.profiles;
create trigger protect_profile_trigger
  before update on public.profiles
  for each row execute procedure public.protect_profile();

-- ============================================================
-- 5. FUNÇÕES FINANCEIRAS (RPC — atômicas, rodam no servidor)
-- ============================================================

-- 5.1) SALÁRIO SEMANAL: credita R$ 1.620,00 por semana decorrida
create or replace function public.creditar_salario()
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_weeks int;
  v_total bigint;
  v_tx text := public.gerar_id_tx();
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.blocked then raise exception 'Sua conta está bloqueada.'; end if;

  v_weeks := floor(extract(epoch from (now() - v_me.last_salary_at)) / (7 * 86400));
  if v_weeks < 1 then return 0; end if;

  v_total := v_weeks * 162000;
  update public.profiles
    set balance = balance + v_total,
        last_salary_at = last_salary_at + (v_weeks * 7 || ' days')::interval
    where id = v_me.id;

  insert into public.transactions (id, user_id, type, category, description, amount, direction, balance_after)
  values (
    v_tx, v_me.id, 'salario', 'entrada',
    case when v_weeks > 1
      then 'Salário semanal — Paróquia (virtual), ' || v_weeks || ' semanas'
      else 'Salário semanal — Paróquia (virtual)' end,
    v_total, 'in', v_me.balance + v_total
  );
  return v_total;
end $$;

-- 5.2) DÍZIMO (e futuros débitos simples do próprio usuário)
create or replace function public.registrar_dizimo(p_valor bigint, p_descricao text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_tx text := public.gerar_id_tx();
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.blocked then raise exception 'Sua conta está bloqueada.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.'; end if;
  if p_valor > v_me.balance then raise exception 'Saldo insuficiente para esta contribuição.'; end if;

  update public.profiles set balance = balance - p_valor where id = v_me.id;
  insert into public.transactions (id, user_id, type, category, description, amount, direction, balance_after, receiver_name)
  values (v_tx, v_me.id, 'dizimo', 'dizimo', p_descricao, p_valor, 'out', v_me.balance - p_valor, 'Paróquia Nossa Senhora da Conceição');

  return to_jsonb(t) from public.transactions t where t.id = v_tx;
end $$;

-- 5.3) PIX VIRTUAL: resolve a chave, debita e credita — atômico
create or replace function public.enviar_pix(p_chave text, p_valor bigint, p_descricao text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_dest public.profiles;
  v_tx text := public.gerar_id_tx();
  v_digitos text := regexp_replace(p_chave, '\D', '', 'g');
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.blocked then raise exception 'Sua conta está bloqueada.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe um valor maior que zero.'; end if;

  -- 1) procura pela chave exata (e-mail, telefone, CPF, aleatória)
  select * into v_dest from public.profiles p
  where exists (
    select 1 from jsonb_array_elements(p.pix_keys) k
    where lower(k->>'value') = lower(trim(p_chave))
       or (k->>'type' = 'telefone' and length(v_digitos) >= 10
           and regexp_replace(k->>'value', '\D', '', 'g') like '%' || v_digitos)
  )
  limit 1;

  -- 2) formato legado usuario@nsconceicao
  if v_dest.id is null then
    select * into v_dest from public.profiles
    where lower(username) = lower(regexp_replace(trim(p_chave), '@nsconceicao(\.hab)?$', ''))
    limit 1;
  end if;

  if v_dest.id is null then raise exception 'Chave Pix virtual não encontrada.'; end if;
  if v_dest.id = v_me.id then raise exception 'Você não pode enviar um Pix para si mesmo.'; end if;
  if p_valor > v_me.balance then raise exception 'Saldo insuficiente para esta operação.'; end if;

  update public.profiles set balance = balance - p_valor where id = v_me.id;
  update public.profiles set balance = balance + p_valor where id = v_dest.id;

  insert into public.transactions (id, user_id, type, category, description, amount, direction, balance_after, sender_name, receiver_name, pix_key)
  values (v_tx, v_me.id, 'pix_enviado', 'pix', 'Pix enviado para ' || v_dest.nome_completo, p_valor, 'out', v_me.balance - p_valor, v_me.nome_completo, v_dest.nome_completo, trim(p_chave));

  insert into public.transactions (id, user_id, type, category, description, amount, direction, balance_after, sender_name, receiver_name, pix_key)
  values (public.gerar_id_tx(), v_dest.id, 'pix_recebido', 'pix', 'Pix recebido de ' || v_me.nome_completo, p_valor, 'in', v_dest.balance + p_valor, v_me.nome_completo, v_dest.nome_completo, trim(p_chave));

  return to_jsonb(t) from public.transactions t where t.id = v_tx;
end $$;

-- 5.4) RESOLVER CHAVE PIX (apenas para exibir o nome na confirmação)
create or replace function public.resolver_pix(p_chave text)
returns table (id uuid, nome_completo text, username text)
language plpgsql security definer set search_path = public
as $$
declare
  v_digitos text := regexp_replace(p_chave, '\D', '', 'g');
begin
  return query
  select p.id, p.nome_completo, p.username
  from public.profiles p
  where exists (
    select 1 from jsonb_array_elements(p.pix_keys) k
    where lower(k->>'value') = lower(trim(p_chave))
       or (k->>'type' = 'telefone' and length(v_digitos) >= 10
           and regexp_replace(k->>'value', '\D', '', 'g') like '%' || v_digitos)
  )
  or lower(p.username) = lower(regexp_replace(trim(p_chave), '@nsconceicao(\.hab)?$', ''))
  limit 1;
end $$;

-- 5.5) CRIAR CHAVE PIX (valida tipo + unicidade global)
create or replace function public.criar_chave_pix(p_tipo text, p_valor text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_valor text := trim(p_valor);
  v_norm text;
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_me from public.profiles where id = auth.uid();

  if p_tipo = 'email' then
    v_norm := lower(v_valor);
    if v_norm !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Informe um e-mail válido (fictício).'; end if;
  elsif p_tipo = 'telefone' then
    v_norm := '+55' || regexp_replace(v_valor, '\D', '', 'g');
    if length(regexp_replace(v_norm, '\D', '', 'g')) < 10 or length(regexp_replace(v_norm, '\D', '', 'g')) > 13 then
      raise exception 'Informe um telefone com DDD (fictício).';
    end if;
  elsif p_tipo = 'cpf' then
    v_norm := regexp_replace(v_valor, '\D', '', 'g');
    if length(v_norm) <> 11 then raise exception 'O CPF fictício deve ter 11 dígitos.'; end if;
    v_norm := substr(v_norm,1,3) || '.' || substr(v_norm,4,3) || '.' || substr(v_norm,7,3) || '-' || substr(v_norm,10,2);
  else
    v_norm := lower(v_valor);
    if v_norm !~ '^[a-z0-9._-]{3,40}$' then raise exception 'Chave aleatória: use 3–40 caracteres (letras, números, . _ -).'; end if;
  end if;

  -- unicidade global
  if exists (
    select 1 from public.profiles p
    where exists (select 1 from jsonb_array_elements(p.pix_keys) k where lower(k->>'value') = v_norm)
  ) then
    raise exception 'Esta chave já está em uso por outra conta.';
  end if;
  if exists (select 1 from jsonb_array_elements(v_me.pix_keys) k where lower(k->>'value') = v_norm) then
    raise exception 'Você já possui esta chave.';
  end if;

  update public.profiles
  set pix_keys = pix_keys || jsonb_build_array(jsonb_build_object(
    'value', v_norm, 'type', p_tipo,
    'label', case p_tipo when 'email' then 'E-mail' when 'telefone' then 'Telefone' when 'cpf' then 'CPF' else 'Chave aleatória' end,
    'createdAt', extract(epoch from now())*1000
  ))
  where id = v_me.id;

  return v_norm;
end $$;

-- 5.6) PAGAR BOLETO FICTÍCIO
create or replace function public.pagar_boleto(p_codigo text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_b public.boletos;
  v_tx text := public.gerar_id_tx();
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.blocked then raise exception 'Sua conta está bloqueada.'; end if;

  select * into v_b from public.boletos where code = trim(p_codigo);
  if not found then raise exception 'Boleto não encontrado. Verifique o código digitado.'; end if;
  if v_b.status = 'pago' then raise exception 'Este boleto já foi pago.'; end if;
  if v_b.amount > v_me.balance then raise exception 'Saldo insuficiente para esta operação.'; end if;

  update public.profiles set balance = balance - v_b.amount where id = v_me.id;
  update public.boletos set status = 'pago' where code = v_b.code;

  insert into public.transactions (id, user_id, type, category, description, amount, direction, balance_after, receiver_name, reference)
  values (v_tx, v_me.id, 'boleto', 'boleto', 'Boleto pago — ' || v_b.beneficiary, v_b.amount, 'out', v_me.balance - v_b.amount, v_b.beneficiary, v_b.code);

  return to_jsonb(t) from public.transactions t where t.id = v_tx;
end $$;

-- 5.7) PAGAR TAXA/IMPOSTO DO BAIRRO
create or replace function public.pagar_taxa(p_fee_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_me public.profiles;
  v_f public.fees;
  v_tx text := public.gerar_id_tx();
begin
  if auth.uid() is null then raise exception 'Não autenticado.'; end if;
  select * into v_me from public.profiles where id = auth.uid();
  if v_me.blocked then raise exception 'Sua conta está bloqueada.'; end if;

  select * into v_f from public.fees where id = trim(p_fee_id) for update;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if v_f.status <> 'pendente' then raise exception 'Esta cobrança não está mais em aberto.'; end if;
  if v_f.amount > v_me.balance then raise exception 'Saldo insuficiente para esta operação.'; end if;

  update public.profiles set balance = balance - v_f.amount where id = v_me.id;
  update public.fees set status = 'paga', paid_by = v_me.id, paid_at = now() where id = v_f.id;

  insert into public.transactions (id, user_id, type, category, description, amount, direction, balance_after, receiver_name, reference)
  values (v_tx, v_me.id, 'taxa', 'taxa', 'Taxa paga — ' || v_f.description, v_f.amount, 'out', v_me.balance - v_f.amount, 'Prefeitura/Paróquia do bairro (virtual)', v_f.id);

  return to_jsonb(t) from public.transactions t where t.id = v_tx;
end $$;

-- 5.8) UTILITÁRIOS DE CADASTRO/LOGIN
create or replace function public.username_existe(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;

create or replace function public.email_de_username(p_username text)
returns text
language sql stable security definer set search_path = public
as $$
  select u.email from auth.users u
  join public.profiles p on p.id = u.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

-- ============================================================
-- 6. DADOS DE DEMONSTRAÇÃO (boletos + cobranças fictícios)
-- ============================================================

insert into public.boletos (code, beneficiary, amount, due_date, description) values
  ('2379100010000010000000000000001', 'Casa Elétrica Habblet LTDA', 12000, current_date + 7, 'Conta de energia virtual'),
  ('2379100010000010000000000000002', 'Cantina da Paróquia', 4500, current_date + 4, 'Festa junina — kit lanche'),
  ('2379100010000010000000000000003', 'Escola Cristo Rei', 30000, current_date + 20, 'Material escolar virtual'),
  ('2379100010000010000000000000004', 'Açougue Bom Pastor', 18750, current_date - 3, 'Compra do mês')
on conflict (code) do nothing;

insert into public.fees (id, description, amount, due_date, bairro) values
  ('FEE-DEMO-1', 'Taxa de manutenção do bairro', 4500, current_date + 5, 'Vila Conceição'),
  ('FEE-DEMO-2', 'Taxa comunitária', 3000, current_date + 9, ''),
  ('FEE-DEMO-3', 'Imposto territorial virtual', 12000, current_date + 12, ''),
  ('FEE-DEMO-4', 'Taxa de iluminação', 2500, current_date + 3, ''),
  ('FEE-DEMO-5', 'Taxa paroquial', 2000, current_date + 15, '')
on conflict (id) do nothing;

-- ============================================================
-- 7. TORNAR-SE ADMINISTRADOR
-- ============================================================
-- 1) Crie uma conta normalmente pelo app (ex.: admin@paroquia.com).
-- 2) Depois execute no SQL Editor (troque o e-mail):
--    update public.profiles set role = 'admin' where username = 'admin';
--    (ou: ... where id = (select id from auth.users where email = 'admin@paroquia.com'))
-- ============================================================
