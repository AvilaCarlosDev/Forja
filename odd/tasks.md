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
| 6 | Ejecutar `0002_forja_profile_details.sql` en Supabase real | Hecho | ver fases 3.2–4, tarea 9 |

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
| 9 | Ejecutar 0002–0005 en Supabase y sus dos pruebas | Hecho (2026-10-06, por Claude con permiso de Carlos) | huella SHA-256 de cada archivo verificada en el editor antes de correrlo; Supabase real: **13/13** y **24/24**; después: 0 usuarios de prueba, 5 gimnasios verificados, 0 vínculos, 0 medidas |
| 10 | Recorrido real con dos cuentas (entrenador y cliente) | Pendiente, con Carlos | — |

## Publicación (2026-10-06)

`forja/3.1-perfil` fusionada por avance rápido en `forja/fase-1` y desplegada en https://forja-trainer.vercel.app: el bundle publicado contiene el asistente, Mi coach y los gimnasios; `forja/login.webm` responde 200 (825 KB); la pantalla de entrada carga sin errores de consola.

## 0008 — Finanzas solo para el plan Pro (2026-10-07)

Alcance: la app ya escondía Finanzas a los entrenadores Free, pero las funciones de 0007 no lo verificaban. Ahora la base lo exige y se quita EXECUTE de PUBLIC.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | `0008_forja_finanzas_pro.sql`: `forja_require_pro()` en mensualidad, registrar y borrar pago; leer el historial sigue abierto | Hecho | `0008_forja_finanzas_pro.test.sql` **8/8** en PGlite; 0002 13/13, 0005 24/24, 0006 8/8, 0007 12/12 (su prueba ahora usa entrenadores Pro) |
| 2 | La vista previa aplica la misma regla (`requirePro` en `forja-api.js`) | Hecho | `Finanzas.test.jsx`: plan Free rechaza las tres escrituras |
| 3 | Suite completa | Hecho | 3269/3278 con Node 22; los 9 rojos (SyncBanner, media-prefetch, default-lang, CoachChat) los causa `frontend/.env.local` y también fallan en HEAD con ese archivo; sin él pasan |
| 4 | Ejecutar 0008 y su prueba en Supabase real | Pendiente | — |

## 0009 — Dieta del cliente (función Pro) (2026-10-07)

Alcance: el entrenador Pro arma la dieta de su cliente (comidas del día con alimentos y porciones, objetivos diarios y totales calculados por alimento). El cliente la ve en solo lectura. Con Free no se muestra ni se edita, pero no se borra. Regla de `docs/PLAN.md`: dietas, finanzas y comparativa son Pro.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | `lib/forja-diet.js`: 41 alimentos comunes en Venezuela (valores aproximados por 100 g), porciones caseras, totales por comida y por día contra el objetivo, alimento propio | Hecho | `forja-diet.test.js` 9/9 (incluye coherencia kcal ≈ 4/4/9 de cada alimento) |
| 2 | `0009_forja_dietas.sql`: tabla `diet_plans` (una por cliente), lectura por RLS, escritura solo por `forja_set_diet` / `forja_delete_diet` (Pro vigente + entrenador activo) y validación de forma y límites | Hecho | `0009_forja_dietas.test.sql` **11/11** en PGlite; la prueba 4 encontró un hueco (alimento sin gramos pasaba por NULL) y quedó corregido |
| 3 | Pantalla `views/forja/Diet.jsx`: vista con barras contra el objetivo y editor (buscar alimento, gramos, alimento propio, comidas, indicaciones) en la ficha del cliente y en Mi coach | Hecho | `Diet.test.jsx` 5/5; recorrido en el navegador con las dos sesiones demo |
| 4 | Sesiones demo con dietas (María, José y Lucía) | Hecho | `scripts/forja-demo-sessions.mjs` |
| 5 | Suite y build | Hecho | 3283/3292 (los 9 rojos de `.env.local`, ver 0008); build ok |
| 6 | Ejecutar 0008 y 0009 con sus pruebas en Supabase real | Pendiente | — |

## v0.9.0 — Finanzas Pro, dietas, gráficas, clientes por gimnasio y avisos (2026-10-07)

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Gráfica de evolución por medida (Pro), con la meta de peso | Hecho | `forja-coach.test.js` (`metricSeries`, `chartableMetrics`); recorrido en el navegador |
| 2 | Sesiones demo con meses de historia (6 meses María, 4 José, 5 Ana, 6 Lucía) y curvas reales | Hecho | `scripts/forja-demo-sessions.mjs` |
| 3 | Dieta: grilla de íconos por categoría, porciones rápidas, plantillas (déficit, mantenimiento, volumen), copiar de otro cliente, íconos también en la vista del cliente | Hecho | `forja-diet.test.js` 12/12, `Diet.test.jsx` 7/7 |
| 4 | Fase 1 de `docs/plan-coach-controla.md`: «Estoy en…» filtra los clientes por gimnasio | Hecho | `forja-coach.test.js` (`clientsAtGym`, `gymOptions`); navegador |
| 5 | Fase 2: `0010_forja_avisos.sql`, avisos al cliente al guardar su dieta o cargarle medidas (sin repetir en el día si no leyó) | Hecho | `0010_forja_avisos.test.sql` **6/6** en PGlite; 0002–0009 siguen verdes |
| 6 | Suite y build | Hecho | 3293/3302 (los 9 rojos de `.env.local`); build ok |
| 7 | Ejecutar 0008, 0009 y 0010 en Supabase real y `vercel --prod` | Pendiente, con OK de Carlos | — |

## Después de v0.9.0 (2026-10-07, tarde)

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Tarjeta del gimnasio con foto del logo (cámara o galería), dirección y logos en la lista | Hecho | `ProfileEdit.test.jsx` |
| 2 | Tarjeta de perfil en el inicio; botones en vez de enlaces en Mi coach, meta y dieta | Hecho | navegador |
| 3 | Check-in con QR de openGym escondido en Forja (la asistencia va aparte, fase 5) | Hecho | `Home`/`Settings` tests |
| 4 | Peso (obligatorio) y talla al completar el perfil; sin pedir peso antes de cada entrenamiento | Hecho | `Onboarding.test.jsx`, `forja-profile.test.js` |
| 5 | Funciones Pro bloqueadas (dieta, evolución, comparativa) abren «Mejora tu suscripción» o explican que depende del coach; botón de WhatsApp de planes | Hecho | `Diet.test.jsx`, `FreeLimit.test.jsx` |
| 6 | `0011_forja_limite_free.sql`: al vencer Pro, el coach ve solo sus 5 clientes más antiguos (vínculos, perfiles, fotos, medidas, metas y dieta) | Hecho | `0011_forja_limite_free.test.sql` **9/9**; 0002–0010 siguen verdes; `FreeLimit.test.jsx` 2/2 |
| 7 | Suite y build | Hecho | 3299/3308 (los 9 rojos de `.env.local`); build ok |

## Suite en verde (2026-10-07)

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | 8 rojos (SyncBanner, idioma por defecto, media-prefetch) los causaba `frontend/.env.local` (modo vista previa de Forja y CDN de imágenes): `vite.config.js` → `test.env` los anula durante las pruebas | Hecho | la suite ya no depende del `.env.local` de cada máquina |
| 2 | `CoachChat.demo-failure` fallaba a veces: la importación dinámica del Coach demo no alcanzaba a resolverse en las 20 microtareas de `flush` con la máquina ocupada. La prueba ahora la carga antes (`beforeAll`) | Hecho | 3 corridas sueltas y 2 suites completas en verde |
| 3 | Suite completa | Hecho | **3308/3308** con Node 22, dos veces; SQL 8/8 archivos OK (0002, 0005–0011); build ok |

## Fase 3 — Rutinas asignadas (2026-10-07)

Alcance: el coach (Free o Pro, dentro de su cupo) arma rutinas para su cliente con el buscador de ejercicios de openGym y les pone series, repeticiones, peso e indicaciones. El cliente recibe el aviso, la rutina entra a su plan de la semana y a «Entrenar», y se entrena tal cual (sin progresión automática). En Plan la ve en solo lectura, con la animación de cada ejercicio.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | `0012_forja_rutinas.sql`: tabla `assigned_routines`, lectura por RLS, escritura solo por `forja_set_routine` / `forja_delete_routine` (coach activo dentro del cupo), validación y aviso `routine_assigned` | Hecho | `0012_forja_rutinas.test.sql` **10/10**; 0002–0011 siguen verdes |
| 2 | `lib/forja-routines.js`: formulario, conversión a rutina de openGym (`excludeFromProgression`), mezcla en el plan y la semana sin tocar las rutinas propias | Hecho | `forja-routines.test.js` 6/6 (incluye que la sesión abre con el peso del coach aunque el historial sea mayor) |
| 3 | Pantallas: «Rutinas» en la ficha del cliente (asignar, editar, ordenar, borrar), «Mis rutinas» en Mi coach, rutina asignada en solo lectura desde Plan, detalle del ejercicio con su animación | Hecho | `Routines.test.jsx` 3/3; navegador |
| 4 | Sincronización al abrir la app y al volver a ella (`AssignedSync`) | Hecho | `Routines.test.jsx` |
| 5 | Sesiones demo con rutinas asignadas (María, José, Lucía) | Hecho | `scripts/forja-demo-sessions.mjs` |
| 6 | Suite y build | Hecho | **3317/3317**; SQL 9/9 archivos; build ok |

## Seguridad: prioritarias de Cyber Neo y términos al entrar (2026-10-07, noche)

Informe: `~/cyber-neo-report-Forja-orquestador-2026-10-07.md`.

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | CN-004: sesiones demo fuera de `public/` (a `frontend/demo/`, solo con `npm run dev`); el cargador ya no usa `eval` ni `localStorage.clear()` y se niega si hay sesión real o entrenamientos | Hecho | `demo/cargar.test.js` 6/6; el build no las incluye |
| 2 | CN-005: `frontend/vercel.json` con CSP, `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy y HSTS; el script de idioma pasa a `public/lang-dir.js` | Hecho | `security-headers.test.js` 5/5; build servido con las cabeceras en Chromium: 6 pantallas sin violaciones |
| 3 | Casilla obligatoria de términos y privacidad en «Entrar»; Google/Apple no salen sin ella (también en «Crear cuenta») | Hecho | `Auth.terms.test.jsx` 5/5; captura |
| 4 | CN-003: `0013_forja_perfil_privado.sql`, lectura de `profiles` por columna (sin `is_admin`, `terms_accepted_at`, `role_chosen` ni fechas internas); la fila propia por `forja_me()` | Hecho | `0013_forja_perfil_privado.test.sql` **8/8** (4/8 sin el revoke); `forja-session.test.js` 3/3 |
| 5 | Suite y build | Hecho | **3337/3337**; SQL 10/10 archivos; build ok |
| 6 | Ejecutar 0008–0013 en Supabase real y `vercel --prod` | Hecho | pruebas en producción: 0008 8/8, 0009 11/11, 0010 6/6, 0011 9/9, 0012 10/10, 0013 8/8; forja-trainer.vercel.app con CSP, sin sesiones demo (404), service worker activo |
