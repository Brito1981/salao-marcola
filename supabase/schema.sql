-- =============================================================================
-- SALÃO DO MARCOLA — Schema do banco (Supabase / PostgreSQL)
-- Rode este arquivo no Supabase: Dashboard > SQL Editor > New query > Run.
-- É idempotente (pode rodar mais de uma vez sem quebrar).
-- =============================================================================

create extension if not exists pgcrypto;   -- para gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 1) CONFIGURAÇÕES  (linha única, id = 1)
-- Colunas pedidas + extras necessárias para NÃO mudar a experiência atual
-- (horários por dia, datas bloqueadas, senha do painel, etc.)
-- -----------------------------------------------------------------------------
create table if not exists public.configuracoes (
  id                 int primary key default 1,
  nome_empresa       text    not null default 'Salão do Marcola',
  endereco           text    default '',
  telefone           text    default '',           -- extra (rodapé)
  whatsapp           text    default '',
  instagram          text    default '',
  facebook           text    default '',
  google_maps        text    default '',           -- extra (rodapé)
  pix_chave          text    default '',
  pix_nome           text    default '',
  pix_banco          text    default '',
  pix_cidade         text    default '',            -- extra (BR Code do PIX)
  logo               text    default 'M',           -- emoji/URL do logo
  horario_abertura   text    default '09:00',
  horario_fechamento text    default '19:00',
  horarios           jsonb   default '{}'::jsonb,    -- extra: horário por dia da semana
  datas_bloqueadas   jsonb   default '[]'::jsonb,    -- extra: feriados/folgas pontuais
  horarios_bloqueados jsonb  default '[]'::jsonb,    -- extra: bloqueios de horário avulsos
  slot_step          int     default 40,            -- extra: passo da grade de horários
  tema               text    default 'dark',         -- extra: modo claro/escuro
  admin_senha        text    default 'marcola123',   -- extra: login do painel (ETAPA 1)
  single_row         boolean default true unique,    -- garante 1 linha só
  atualizado_em      timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 2) SERVIÇOS
-- -----------------------------------------------------------------------------
create table if not exists public.servicos (
  id        uuid primary key default gen_random_uuid(),
  nome      text    not null,
  valor     numeric(10,2) not null default 0,
  duracao   int     not null default 40,            -- minutos
  ordem     int     not null default 0,             -- posição na lista do cliente
  ativo     boolean not null default true,
  icone     text    default '✂️',                    -- extra: emoji exibido no card
  criado_em timestamptz default now()
);
create index if not exists servicos_ordem_idx on public.servicos (ordem);

-- -----------------------------------------------------------------------------
-- 3) BARBEIROS / PROFISSIONAIS (extra: necessário para preservar a Etapa 2 e o
-- CRUD de profissionais do painel — caso contrário voltaria a ser valor fixo)
-- -----------------------------------------------------------------------------
create table if not exists public.barbeiros (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  funcao    text default 'Barbeiro',
  icone     text default '💈',
  ordem     int  default 0,
  ativo     boolean default true,
  criado_em timestamptz default now()
);

-- -----------------------------------------------------------------------------
-- 4) CLIENTES
-- -----------------------------------------------------------------------------
create table if not exists public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text not null,
  email       text default '',
  observacoes text default '',
  criado_em   timestamptz default now()
);
-- 1 cliente por telefone (usado para histórico / recorrência)
create unique index if not exists clientes_telefone_key on public.clientes (telefone);

-- -----------------------------------------------------------------------------
-- 5) AGENDAMENTOS
-- -----------------------------------------------------------------------------
create table if not exists public.agendamentos (
  id          uuid primary key default gen_random_uuid(),
  protocolo   text unique not null,
  servico_id  uuid references public.servicos(id)  on delete set null,
  barbeiro_id uuid references public.barbeiros(id) on delete set null,
  cliente_id  uuid references public.clientes(id)  on delete set null,
  data        date not null,
  hora        text not null,                         -- "HH:MM"
  duracao     int  not null,
  valor       numeric(10,2) not null default 0,
  status      text not null default 'pendente',      -- pendente | confirmado | cancelado
  observacao  text default '',
  criado_em   timestamptz default now(),
  pago_em     timestamptz
);
create index if not exists agendamentos_data_idx on public.agendamentos (data);
-- Trava de duplicidade no banco: nunca dois ativos no mesmo barbeiro/data/hora
create unique index if not exists agendamentos_slot_unico
  on public.agendamentos (barbeiro_id, data, hora)
  where status <> 'cancelado';

-- =============================================================================
-- RLS (Row Level Security)
-- ETAPA 1: o painel ainda usa senha no app (sem Supabase Auth), então as
-- escritas administrativas usam a anon key. As políticas abaixo deixam o app
-- 100% funcional. Em uma próxima etapa, mova o admin para Supabase Auth e
-- restrinja as escritas a usuários autenticados (exemplo comentado no final).
-- =============================================================================
alter table public.configuracoes enable row level security;
alter table public.servicos      enable row level security;
alter table public.barbeiros     enable row level security;
alter table public.clientes      enable row level security;
alter table public.agendamentos  enable row level security;

-- Leitura pública
create policy "leitura publica config"     on public.configuracoes for select using (true);
create policy "leitura publica servicos"   on public.servicos      for select using (true);
create policy "leitura publica barbeiros"  on public.barbeiros     for select using (true);
create policy "leitura publica agend"      on public.agendamentos  for select using (true);

-- Escrita (ETAPA 1: liberada via anon — necessário para painel e para o cliente agendar)
create policy "escrita config"    on public.configuracoes for all using (true) with check (true);
create policy "escrita servicos"  on public.servicos      for all using (true) with check (true);
create policy "escrita barbeiros" on public.barbeiros     for all using (true) with check (true);
create policy "escrita clientes"  on public.clientes      for all using (true) with check (true);
create policy "escrita agend"     on public.agendamentos  for all using (true) with check (true);

-- =============================================================================
-- SEED — dados iniciais (idênticos ao protótipo). Só insere se estiver vazio.
-- =============================================================================
insert into public.configuracoes (id, nome_empresa, endereco, telefone, whatsapp,
  instagram, facebook, google_maps, pix_chave, pix_nome, pix_banco, pix_cidade,
  logo, horario_abertura, horario_fechamento, horarios, slot_step, tema, admin_senha)
values (1, 'Salão do Marcola',
  'Av. Gov. Roberto Silveira, 1200 — Nova Iguaçu, RJ', '(21) 3000-0000', '5521999990000',
  'https://instagram.com/salaodomarcola', 'https://facebook.com/salaodomarcola',
  'https://maps.google.com/?q=Salão+do+Marcola+Nova+Iguaçu',
  'marcola@email.com', 'Marcos Oliveira', 'Nubank', 'Rio de Janeiro',
  'M', '09:00', '19:00',
  '{"0":{"on":false,"start":"09:00","end":"18:00"},
    "1":{"on":true,"start":"09:00","end":"19:00"},
    "2":{"on":true,"start":"09:00","end":"19:00"},
    "3":{"on":true,"start":"09:00","end":"19:00"},
    "4":{"on":true,"start":"09:00","end":"19:00"},
    "5":{"on":true,"start":"09:00","end":"20:00"},
    "6":{"on":true,"start":"08:00","end":"17:00"}}'::jsonb,
  40, 'dark', 'marcola123')
on conflict (id) do nothing;

insert into public.barbeiros (nome, funcao, icone, ordem)
select 'Marcola', 'Barbeiro & Proprietário', '💈', 1
where not exists (select 1 from public.barbeiros);

insert into public.servicos (nome, valor, duracao, ordem, icone)
select * from (values
  ('Corte Masculino', 35.00, 40, 1, '✂️'),
  ('Barba',           25.00, 30, 2, '🪒'),
  ('Corte + Barba',   55.00, 60, 3, '💈'),
  ('Pigmentação',     45.00, 40, 4, '🎨'),
  ('Sobrancelha',     15.00, 15, 5, '⚡'),
  ('Corte Infantil',  30.00, 40, 6, '🧒')
) as v(nome, valor, duracao, ordem, icone)
where not exists (select 1 from public.servicos);

-- =============================================================================
-- (OPCIONAL — ETAPA 2) Política mais segura quando migrar o admin para Auth:
--   drop policy "escrita servicos" on public.servicos;
--   create policy "admin escreve servicos" on public.servicos
--     for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
--   (repetir para configuracoes, barbeiros; manter clientes/agendamentos com insert público)
-- =============================================================================
