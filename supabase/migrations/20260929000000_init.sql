-- Burgundy: gastos de la florería
-- Correr entero en Supabase > SQL Editor.
-- Acceso: solo desde el servidor con la secret key (service_role).
-- RLS queda activado y sin políticas, así la anon key no puede leer nada.

create extension if not exists pgcrypto;

-- Categorías ------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#8B2942',
  orden int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categorias (nombre, color, orden) values
  ('Flores y plantas',  '#8B2942', 1),
  ('Insumos',           '#C2410C', 2),
  ('Packaging',         '#B45309', 3),
  ('Servicios',         '#0F766E', 4),
  ('Alquiler',          '#1D4ED8', 5),
  ('Sueldos',           '#6D28D9', 6),
  ('Transporte y envíos','#0369A1', 7),
  ('Impuestos',         '#4B5563', 8),
  ('Mantenimiento',     '#A16207', 9),
  ('Otros',             '#6B7280', 10);

-- Gastos fijos (plantillas que se repiten cada mes) ----------------------
create table public.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  monto numeric(12,2) not null check (monto >= 0),
  categoria_id uuid references public.categorias(id) on delete set null,
  dia int not null default 1 check (dia between 1 and 31),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Gastos (todo lo que salió de caja) ------------------------------------
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  monto numeric(12,2) not null check (monto >= 0),
  descripcion text not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  tipo text not null default 'variable' check (tipo in ('fijo', 'variable')),
  origen text not null default 'manual' check (origen in ('audio', 'texto', 'manual', 'fijo')),
  gasto_fijo_id uuid references public.gastos_fijos(id) on delete set null,
  -- primer día del mes al que corresponde el fijo; evita duplicarlo
  periodo date,
  transcripcion text,
  created_at timestamptz not null default now()
);

create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_categoria_idx on public.gastos (categoria_id);
create index gastos_fijo_idx on public.gastos (gasto_fijo_id);

-- Registro de qué fijo ya se generó en qué mes. Si el dueño borra
-- el gasto de un mes, no se vuelve a crear.
create table public.fijos_generados (
  gasto_fijo_id uuid not null references public.gastos_fijos(id) on delete cascade,
  periodo date not null,
  created_at timestamptz not null default now(),
  primary key (gasto_fijo_id, periodo)
);

-- Genera los gastos fijos del mes que falten. Es idempotente:
-- se puede llamar todas las veces que haga falta.
create or replace function public.generar_gastos_fijos(p_mes date)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_periodo date := date_trunc('month', p_mes)::date;
  v_ultimo_dia int := extract(day from (v_periodo + interval '1 month - 1 day'))::int;
  v_insertados int;
begin
  with nuevos as (
    insert into public.fijos_generados (gasto_fijo_id, periodo)
    select f.id, v_periodo
    from public.gastos_fijos f
    where f.activo
    on conflict do nothing
    returning gasto_fijo_id
  )
  insert into public.gastos (fecha, monto, descripcion, categoria_id, tipo, origen, gasto_fijo_id, periodo)
  select
    v_periodo + (least(f.dia, v_ultimo_dia) - 1),
    f.monto,
    f.nombre,
    f.categoria_id,
    'fijo',
    'fijo',
    f.id,
    v_periodo
  from nuevos n
  join public.gastos_fijos f on f.id = n.gasto_fijo_id;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

-- Totales por mes para el gráfico ----------------------------------------
create or replace view public.resumen_mensual
with (security_invoker = true) as
select
  date_trunc('month', fecha)::date as mes,
  sum(monto) filter (where tipo = 'fijo')     as fijos,
  sum(monto) filter (where tipo = 'variable') as variables,
  sum(monto)                                   as total,
  count(*)                                     as cantidad
from public.gastos
group by 1;

-- Seguridad --------------------------------------------------------------
alter table public.categorias   enable row level security;
alter table public.gastos_fijos enable row level security;
alter table public.gastos       enable row level security;
alter table public.fijos_generados enable row level security;

revoke all on public.categorias, public.gastos_fijos, public.gastos, public.fijos_generados, public.resumen_mensual
  from anon, authenticated;
revoke execute on function public.generar_gastos_fijos(date) from public, anon, authenticated;
grant execute on function public.generar_gastos_fijos(date) to service_role;
