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

## Fase 2 — Vercel + Supabase

Pendiente de plan.
