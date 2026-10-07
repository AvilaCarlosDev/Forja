# Forja — tareas

Spec: `docs/superpowers/specs/2026-10-06-forja-design.md`

## Fase 1 — Fork, identidad y créditos

Alcance: dejar el fork identificado como Forja, con créditos correctos a openGym, sin cambiar comportamiento.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Spec, políticas y este archivo en el repo | Hecho | commit `docs:` |
| 2 | Nombre visible Forja (título, manifest, Capacitor) | Hecho | `npm test` y `npm run build` en `frontend/` |
| 3 | README de Forja; README original en `docs/upstream/` | Hecho | commit `docs: README` |
| 4 | Crédito de Forja en `NOTICE.md` | Hecho | commit `docs: NOTICE` |
| 5 | Corregir descripción y enlace del repo en GitHub | Hecho | "About" del repo corregido, enlace a la web de openGym quitado |
| 6 | Workflows heredados (`mirror.yml`, `pages.yml`, `docker-publish.yml`) solo manuales | Hecho | commit `ci:`; YAML validado |
| 7 | Icono y logo propios (hoy se usa el de openGym) | Hecho | iconos 180/192/512, favicon 16/32/48, banner en `assets/brand/`; build y tests |
| 8 | Marca Forja en los textos de la app | Hecho | `frontend/src/lib/brand.js` + `brand.test.js`; 3165/3166 tests |
| 9 | `CoachChat.demo-failure.test.jsx` falla también sin cambios de Forja (heredado, intermitente) | Pendiente de diagnóstico | pasó en la primera corrida, falla en las siguientes |

Fuera de alcance de la fase 1: cualquier cambio de backend, Supabase o Vercel.

## Fase 2 — Cuentas (Vercel + Supabase)

Alcance de 2a: registro e inicio de sesión con correo sobre Supabase Auth, con elección de perfil (Personal Trainer o Cliente) y sexo. Los datos de entrenamiento siguen en el dispositivo; su sincronización con Supabase es 2b.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Librería de auth por REST, sin SDK (`frontend/src/lib/forja-auth.js`) | Hecho | `forja-auth.test.js`, 24 tests |
| 2 | Pantallas: entrar, crear cuenta, recuperar contraseña, enlace del correo | Hecho | recorrido en navegador sin errores de consola (modo vista previa) |
| 3 | Cuenta y cerrar sesión en Ajustes; saludo con el nombre | Hecho | mismo recorrido |
| 4 | Tabla `profiles`, trigger de alta y RLS (`supabase/migrations/0001_forja_profiles.sql`) | Hecho | ejecutado en Supabase el 2026-10-06 |
| 5 | Probar contra Supabase real (registro, confirmación por correo, login, recuperación) | Pendiente, lo hace Carlos | Site URL y redirección configuradas |
| 6 | Archivar la app anterior en `legacy_gymcoach` (`0000b_archivar_app_anterior.sql`, reversible) | Hecho | 2026-10-06: tablas viejas fuera de `public` (404), `profiles` existe y niega a anon (401) |
| 7 | Despliegue del frontend en Vercel con las variables de entorno | Hecho | https://forja-trainer.vercel.app responde 200 con la marca Forja |
| 8 | 2b: guardar el estado de entrenamiento en Supabase | Pendiente de plan | — |

Pendiente de diseño (pedido el 2026-10-06): elegir entrenador al registrarse y cambiarlo después, gimnasio de cada perfil con lista de Punto Fijo, y métricas corporales que acompañan al cliente al cambiar de entrenador.

## Fase 3.1 — Perfil: foto, fecha de nacimiento y tutor (v0.3.0)

Alcance: completar el perfil la primera vez que se entra — foto de perfil, nombre, sexo y fecha de nacimiento. Menores de 18 no se bloquean: piden el consentimiento de madre, padre o tutor. Edad mínima 13.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Migración `0002_forja_profile_details.sql`: `birth_date`, `avatar_path`, `onboarded_at`, tabla `guardian_consents`, RLS y bucket privado `avatars` | Hecho | commit `62fab29`; pruebas locales 13/13 con PGlite (`supabase/tests/run-local.mjs`) |
| 2 | Asistente de perfil (`views/forja/Onboarding.jsx`): datos, paso de tutor si es menor, cierre con `forja_finish_onboarding()` | Hecho | `forja-profile.test.js` (reglas de edad y validación); gate en `App.jsx` |
| 3 | Foto de perfil (`views/forja/Avatar.jsx`): recorte a webp 512 px en el navegador, subida a la carpeta propia, enlace firmado, borra la anterior | Hecho | `forja-db.test.js`; políticas de storage en 0002 |
| 4 | La base solo deja editar nombre, sexo, fecha y foto; `plan`, `is_admin` y `onboarded_at` blindados | Hecho | pruebas 5 y 6 de `0002_forja_profile_details.test.sql` |
| 5 | Suite completa y build | Hecho | 3216/3217 (único rojo: `CoachChat.demo-failure`, heredado); `npm run build` ok |
| 6 | Ejecutar `0002_forja_profile_details.sql` en Supabase real y recorrer el asistente en el navegador | Pendiente, lo hace Carlos | — |

Nota de entorno (2026-10-06): Node 26.8.1 de esta máquina deja `globalThis.localStorage` roto y la suite entera falla (326 rojos falsos). Arreglado con `NODE_OPTIONS=--no-experimental-webstorage` fijado en `mise set -g`; con eso, `npm test` nace verde.

## Fases 3.2, 3.3 y 4 — Gimnasios, vínculo entrenador–cliente y medidas

Alcance: el cliente elige su gimnasio de Punto Fijo (o "Otro", o en casa) y, si tiene, su entrenador de ese gimnasio; el entrenador elige uno o varios gimnasios. La solicitud le llega como notificación; al aceptar, el entrenador carga y corrige peso, talla, grasa, medidas y meta, y el cliente las ve en solo lectura. El cliente puede cambiar de gimnasio y de entrenador; el nuevo entrenador acepta y ve todo el historial, y el anterior pierde el acceso.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Lista de gimnasios con fuente oficial | Hecho | `docs/research/gimnasios-punto-fijo.md`: Gold Stars (Sambil, Las Virtudes, Ciudad del Viento), Altitude, New Life Training Center |
| 2 | `0003_forja_gyms.sql`: gimnasios, "Otro" con red social o logo (sin verificar, usable enseguida), varios gimnasios por entrenador | Hecho | pruebas 1–7 de `0005_forja_trainer_client.test.sql` |
| 3 | `0004_forja_links.sql`: solicitud → aceptar/rechazar, notificaciones, cambio de entrenador, límite Free de 5 | Hecho | pruebas 8–13 y 19–23 |
| 4 | `0005_forja_metrics.sql`: medidas y meta del cliente; con entrenador solo él escribe; el historial sigue al cliente | Hecho | pruebas 14–18, 20, 21 y 24; **24/24** en PGlite; la mutación de las reglas rompe 4 pruebas |
| 5 | Asistente: paso de gimnasio y "¿Tienes entrenador?" | Hecho | `Onboarding.test.jsx` 7/7; recorrido en el navegador (vista previa) |
| 6 | Pestaña Clientes (entrenador): notificaciones, solicitudes, cupo, ficha con selector de cliente, medidas, meta, historial | Hecho | `CoachFlow.test.jsx`; recorrido en el navegador sin errores de consola |
| 7 | Pestaña Mi coach (cliente): cambiar gimnasio y entrenador, novedades, medidas en solo lectura | Hecho | `CoachFlow.test.jsx` |
| 8 | Suite completa y build | Hecho | 3243/3244 con Node 22 (único rojo: `CoachChat.demo-failure`, heredado); build ok |
| 9 | Ejecutar 0002–0005 en Supabase y sus dos pruebas | Pendiente, lo hace Carlos | resultado esperado: `13 de 13` y `24 de 24` |
| 10 | Recorrido real con dos cuentas (entrenador y cliente) | Pendiente, con Carlos | — |
