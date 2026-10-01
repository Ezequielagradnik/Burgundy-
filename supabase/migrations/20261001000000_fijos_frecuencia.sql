-- Burgundy: frecuencias en los gastos fijos (mensual, quincenal, semanal)
-- Correr entero en Supabase > SQL Editor. Se puede correr una sola vez.
--
-- Cambio de comportamiento: cada fijo se anota cuando llega su día
-- (las flores del lunes aparecen el lunes), no todos el día 1.

-- 1. Reglas de frecuencia -------------------------------------------------
alter table public.gastos_fijos
  add column frecuencia text not null default 'mensual'
    check (frecuencia in ('mensual', 'quincenal', 'semanal')),
  -- 1 = lunes ... 7 = domingo (solo semanal)
  add column dias_semana smallint[] not null default '{}',
  -- desde cuándo se anota (se reinicia al reactivar un fijo pausado)
  add column desde date;

update public.gastos_fijos
set desde = date_trunc('month', created_at at time zone 'America/Argentina/Buenos_Aires')::date;

alter table public.gastos_fijos
  alter column desde set not null,
  alter column desde set default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  add constraint gastos_fijos_semanal_con_dias
    check (frecuencia <> 'semanal' or cardinality(dias_semana) > 0),
  add constraint gastos_fijos_dias_validos
    check (dias_semana <@ array[1,2,3,4,5,6,7]::smallint[]),
  add constraint gastos_fijos_quincenal_dia
    check (frecuencia <> 'quincenal' or dia between 1 and 15);

-- 2. Registro por fecha (antes era uno por mes) ----------------------------
alter table public.fijos_generados add column fecha date;

update public.fijos_generados g
set fecha = g.periodo + (least(f.dia, extract(day from (g.periodo + interval '1 month - 1 day'))::int) - 1)
from public.gastos_fijos f
where f.id = g.gasto_fijo_id;

alter table public.fijos_generados
  alter column fecha set not null,
  drop constraint fijos_generados_pkey,
  add primary key (gasto_fijo_id, fecha);

-- 3. Generador: anota todo lo que cayó hasta p_hasta y falte -------------
drop function if exists public.generar_gastos_fijos(date);

create or replace function public.generar_gastos_fijos(p_hasta date)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  -- Mira hasta 2 meses para atrás, por si nadie abrió la app un tiempo
  v_piso date := (date_trunc('month', p_hasta) - interval '2 months')::date;
  v_insertados int;
begin
  with dias as (
    select
      f.id,
      d::date as fecha,
      extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int as ultimo
    from public.gastos_fijos f
    cross join lateral generate_series(greatest(f.desde, v_piso), p_hasta, interval '1 day') d
    where f.activo
  ),
  ocurrencias as (
    select d.id, d.fecha
    from dias d
    join public.gastos_fijos f on f.id = d.id
    where
      (f.frecuencia = 'mensual' and extract(day from d.fecha) = least(f.dia, d.ultimo))
      or (f.frecuencia = 'quincenal' and extract(day from d.fecha) in (least(f.dia, d.ultimo), least(f.dia + 15, d.ultimo)))
      or (f.frecuencia = 'semanal' and extract(isodow from d.fecha)::smallint = any(f.dias_semana))
  ),
  nuevos as (
    insert into public.fijos_generados (gasto_fijo_id, periodo, fecha)
    select o.id, date_trunc('month', o.fecha)::date, o.fecha
    from ocurrencias o
    on conflict do nothing
    returning gasto_fijo_id, periodo, fecha
  )
  insert into public.gastos (fecha, monto, descripcion, categoria_id, tipo, origen, gasto_fijo_id, periodo)
  select n.fecha, f.monto, f.nombre, f.categoria_id, 'fijo', 'fijo', f.id, n.periodo
  from nuevos n
  join public.gastos_fijos f on f.id = n.gasto_fijo_id;

  get diagnostics v_insertados = row_count;
  return v_insertados;
end;
$$;

revoke execute on function public.generar_gastos_fijos(date) from public, anon, authenticated;
grant execute on function public.generar_gastos_fijos(date) to service_role;
