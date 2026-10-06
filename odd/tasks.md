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
| 4 | Tabla `profiles`, trigger de alta y RLS (`supabase/migrations/0001_forja_profiles.sql`) | Escrito, **sin ejecutar** | pendiente de correrlo en Supabase |
| 5 | Probar contra Supabase real (registro, confirmación por correo, login, recuperación) | Pendiente | necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` |
| 6 | Limpiar la app anterior en el proyecto Gymcoach (`0000_revisar_y_limpiar.sql`) | Pendiente, lo ejecuta Carlos | borra datos: revisar antes |
| 7 | Despliegue del frontend en Vercel con las variables de entorno | Pendiente | — |
| 8 | 2b: guardar el estado de entrenamiento en Supabase | Pendiente de plan | — |

Pendiente de diseño (pedido el 2026-10-06): elegir entrenador al registrarse y cambiarlo después, gimnasio de cada perfil con lista de Punto Fijo, y métricas corporales que acompañan al cliente al cambiar de entrenador.
