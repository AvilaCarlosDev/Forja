-- Forja · prueba de 0002 · completar el perfil
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0002_forja_profile_details.sql.
--
-- Crea dos usuarios de prueba, actúa como cada uno y comprueba los permisos. Al final lanza
-- un error A PROPÓSITO con el resumen: así Postgres deshace todo y no queda ningún dato de prueba.
-- Resultado esperado:  ERROR: Forja 0002: 13 de 13 pruebas OK
do $$
declare
  a   uuid := gen_random_uuid();   -- adulto
  m   uuid := gen_random_uuid();   -- menor de edad (16 años)
  ok  int  := 0;
  total int := 13;
  fallos text := '';
  p   public.profiles;
  c   int;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'adulto+' || a || '@prueba.forja', '{"name":"Adulto","sex":"male","role":"client"}'),
    (m, 'menor+'  || m || '@prueba.forja', '{"name":"Menor","sex":"female","role":"client"}');

  ---------------------------------------------------------------- como el adulto
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. No puede terminar sin fecha de nacimiento.
  begin perform public.forja_finish_onboarding(); fallos := fallos || ' [1 terminó sin fecha]';
  exception when others then ok := ok + 1; end;

  -- 2. Fecha en el futuro: rechazada.
  begin update public.profiles set birth_date = current_date + 1 where id = a; fallos := fallos || ' [2 aceptó fecha futura]';
  exception when others then ok := ok + 1; end;

  -- 3. Menor de la edad mínima (10 años): rechazado.
  begin update public.profiles set birth_date = current_date - interval '10 years' where id = a; fallos := fallos || ' [3 aceptó 10 años]';
  exception when others then ok := ok + 1; end;

  -- 4. Adulto con fecha válida: termina el perfil.
  begin
    update public.profiles set birth_date = date '1995-05-20' where id = a;
    p := public.forja_finish_onboarding();
    if p.onboarded_at is not null then ok := ok + 1; else fallos := fallos || ' [4 sin onboarded_at]'; end if;
  exception when others then fallos := fallos || ' [4 ' || sqlerrm || ']'; end;

  -- 5. No puede marcarse onboarded_at a mano.
  begin update public.profiles set onboarded_at = now() where id = a; fallos := fallos || ' [5 editó onboarded_at]';
  exception when others then ok := ok + 1; end;

  -- 6. No puede subirse el plan a Pro.
  begin update public.profiles set plan = 'pro' where id = a; fallos := fallos || ' [6 se puso Pro]';
  exception when others then ok := ok + 1; end;

  -- 7. La foto de perfil solo puede apuntar a su propia carpeta.
  begin update public.profiles set avatar_path = m::text || '/avatar.webp' where id = a; fallos := fallos || ' [7 avatar ajeno]';
  exception when others then ok := ok + 1; end;

  -- 8. Puede subir su foto a su carpeta, pero no a la de otro.
  begin
    insert into storage.objects (bucket_id, name) values ('avatars', a::text || '/avatar.webp');
    begin insert into storage.objects (bucket_id, name) values ('avatars', m::text || '/avatar.webp'); fallos := fallos || ' [8 subió a carpeta ajena]';
    exception when others then ok := ok + 1; end;
  exception when others then fallos := fallos || ' [8 no pudo subir la suya: ' || sqlerrm || ']'; end;

  -- 9. No ve el perfil de otra persona.
  select count(*) into c from public.profiles where id = m;
  if c = 0 then ok := ok + 1; else fallos := fallos || ' [9 ve perfiles ajenos]'; end if;

  reset role;

  ---------------------------------------------------------------- como la menor
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 10. 16 años: la fecha se acepta, pero sin consentimiento no termina.
  begin
    update public.profiles set birth_date = current_date - interval '16 years' where id = m;
    begin perform public.forja_finish_onboarding(); fallos := fallos || ' [10 menor terminó sin consentimiento]';
    exception when others then ok := ok + 1; end;
  exception when others then fallos := fallos || ' [10 rechazó 16 años: ' || sqlerrm || ']'; end;

  -- 11. No puede registrar un consentimiento a nombre de otra persona.
  begin insert into public.guardian_consents (user_id, guardian_name, guardian_email, relationship)
        values (a, 'Alguien', 'alguien@prueba.forja', 'madre'); fallos := fallos || ' [11 consentimiento ajeno]';
  exception when others then ok := ok + 1; end;

  -- 12. Con el consentimiento de su madre, termina el perfil.
  begin
    insert into public.guardian_consents (user_id, guardian_name, guardian_email, relationship)
      values (m, 'María Pérez', 'maria@prueba.forja', 'madre');
    p := public.forja_finish_onboarding();
    if p.onboarded_at is not null then ok := ok + 1; else fallos := fallos || ' [12 sin onboarded_at]'; end if;
  exception when others then fallos := fallos || ' [12 ' || sqlerrm || ']'; end;

  reset role;

  ---------------------------------------------------------------- sin sesión
  set local role anon;
  -- 13. Un visitante sin cuenta no lee consentimientos.
  begin perform 1 from public.guardian_consents limit 1; fallos := fallos || ' [13 anon lee consentimientos]';
  exception when others then ok := ok + 1; end;
  reset role;

  raise exception 'Forja 0002: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
