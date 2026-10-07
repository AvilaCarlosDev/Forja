-- Forja · prueba de 0006 · entrar con Google y elegir el rol después
-- Ejecutar en Supabase → SQL Editor DESPUÉS de 0006. Lanza un error A PROPÓSITO al final para
-- deshacer todo. Resultado esperado:  ERROR: Forja 0006: 8 de 8 pruebas OK
do $$
declare
  g  uuid := gen_random_uuid();   -- cuenta creada con Google (sin rol en los metadatos)
  e  uuid := gen_random_uuid();   -- cuenta creada con el formulario (rol entrenador)
  p  public.profiles;
  ok int := 0; total int := 8; fallos text := '';
begin
  insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
    (g, 'google+' || g || '@prueba.forja', '{"full_name":"Ana Google","email_verified":true}', '{"provider":"google"}'),
    (e, 'correo+' || e || '@prueba.forja', '{"name":"Eva Correo","sex":"female","role":"trainer"}', '{"provider":"email"}');

  -- 1. Google: nombre tomado de full_name, rol sin elegir.
  select * into p from public.profiles where id = g;
  if p.name = 'Ana Google' and not p.role_chosen and p.terms_accepted_at is null then ok := ok + 1;
  else fallos := fallos || ' [1 alta Google]'; end if;
  -- 2. Formulario: rol elegido y términos aceptados.
  select * into p from public.profiles where id = e;
  if p.role = 'trainer' and p.role_chosen and p.terms_accepted_at is not null then ok := ok + 1;
  else fallos := fallos || ' [2 alta correo]'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 3. Sin rol elegido no termina el perfil, aunque tenga todo lo demás.
  update public.profiles set sex = 'female', birth_date = '1995-01-01', remote = true where id = g;
  begin perform public.forja_finish_onboarding(); fallos := fallos || ' [3 terminó sin rol]';
  exception when others then ok := ok + 1; end;
  -- 4. Sin aceptar los términos, no elige rol.
  begin perform public.forja_choose_role('trainer', false); fallos := fallos || ' [4 sin términos]';
  exception when others then ok := ok + 1; end;
  -- 5. Un rol inventado no vale.
  begin perform public.forja_choose_role('admin', true); fallos := fallos || ' [5 rol admin]';
  exception when others then ok := ok + 1; end;
  -- 6. Elige Personal Trainer y acepta.
  p := public.forja_choose_role('trainer', true);
  if p.role = 'trainer' and p.role_chosen and p.terms_accepted_at is not null then ok := ok + 1;
  else fallos := fallos || ' [6 no eligió]'; end if;
  -- 7. Termina el perfil (entrena a distancia).
  begin p := public.forja_finish_onboarding();
    if p.onboarded_at is not null then ok := ok + 1; else fallos := fallos || ' [7 sin onboarded_at]'; end if;
  exception when others then fallos := fallos || ' [7 ' || sqlerrm || ']'; end;
  -- 8. Con el perfil terminado, el rol ya no se cambia desde la app.
  begin perform public.forja_choose_role('client', true); fallos := fallos || ' [8 cambió de rol tras terminar]';
  exception when others then ok := ok + 1; end;
  reset role;

  raise exception 'Forja 0006: % de % pruebas OK%', ok, total,
    case when fallos = '' then '' else ' · FALLOS:' || fallos end;
end $$;
