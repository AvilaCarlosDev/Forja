-- Forja · 0000b · archivar la app anterior sin borrar nada
-- Mueve las tablas viejas de public a legacy_gymcoach: dejan de estar expuestas por la API
-- y se pueden recuperar con 'alter table legacy_gymcoach.X set schema public'.
-- Para borrarlas del todo (irreversible): drop schema legacy_gymcoach cascade;
begin;
create schema if not exists legacy_gymcoach;
alter table if exists public.attendance set schema legacy_gymcoach;
alter table if exists public.client_profiles set schema legacy_gymcoach;
alter table if exists public.client_workout_assignments set schema legacy_gymcoach;
alter table if exists public.coach_profiles set schema legacy_gymcoach;
alter table if exists public.completed_workout_exercises set schema legacy_gymcoach;
alter table if exists public.completed_workouts set schema legacy_gymcoach;
alter table if exists public.exercises set schema legacy_gymcoach;
alter table if exists public.nutrition_plans set schema legacy_gymcoach;
alter table if exists public.physical_progress set schema legacy_gymcoach;
alter table if exists public.subscription_payments set schema legacy_gymcoach;
alter table if exists public.training_session_notes set schema legacy_gymcoach;
alter table if exists public.users set schema legacy_gymcoach;
alter table if exists public.workout_template_exercises set schema legacy_gymcoach;
alter table if exists public.workout_templates set schema legacy_gymcoach;
commit;
