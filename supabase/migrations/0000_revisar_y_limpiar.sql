-- Forja · 0000 · revisar qué dejó la app anterior en el proyecto "Gymcoach"
--
-- PASO 1 (solo lectura, seguro): corre este bloque y mira el resultado.

select 'tabla' as tipo, table_name as nombre, null::bigint as filas
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'usuarios en auth.users', '', count(*) from auth.users
order by 1, 2;

-- PASO 2 (⚠ RIESGO: BORRA DATOS Y NO SE PUEDE DESHACER)
-- Antes: Supabase → Database → Backups, o exporta lo que quieras conservar.
-- Solo después de revisar el paso 1, quita los "--" de las líneas que apliquen y ejecútalas.
--
-- Borrar TODAS las cuentas de usuario (y, en cascada, sus perfiles):
--   delete from auth.users;
--
-- Borrar una tabla vieja de la app anterior (repite por cada una que salió en el paso 1):
--   drop table if exists public.NOMBRE_DE_LA_TABLA cascade;
