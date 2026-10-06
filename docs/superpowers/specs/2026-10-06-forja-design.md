# Forja — spec de diseño

Fecha: 2026-10-06 · Autor: Carlos Ávila · Estado: pendiente de revisión

Destino en el repo: `docs/superpowers/specs/2026-10-06-forja-design.md`

## 1. Objetivo

Forja es una app web (PWA) para que entrenadores personales gestionen a sus clientes, presencial o a distancia: rutinas asignadas, dietas, progreso, asistencia y cobros. El cliente tiene su propia cuenta para ejecutar sus rutinas y ver sus resultados.

Es un proyecto open source y de portafolio. Se financia con un plan Pro del servicio alojado, para cubrir servidor y dominio.

Éxito de la primera versión: un coach real se registra con su correo, invita a un cliente, le asigna una rutina, el cliente la completa desde su teléfono y el coach ve el registro.

## 2. Base y licencia

- Forja es un fork de [openGym](https://github.com/DuarteSantos8/openGym) (React 19 + Vite + Capacitor, API en Node, estado en un JSON por usuario).
- Licencia: **AGPL-3.0**, obligatoria por ser obra derivada. No puede relicenciarse a MIT ni Apache.
- Créditos:
  - Se conservan `LICENSE` y `NOTICE.md` originales con sus avisos de terceros.
  - Se mantiene el copyright de Duarte Santos; se añade el de Carlos Ávila en archivos nuevos o modificados.
  - Sección "Basado en openGym" en el README y en la pantalla "Acerca de".
  - Enlace al código fuente visible dentro de la app (requisito de la AGPL para servicios en red).
- No se usa el nombre ni el logo de openGym como marca de Forja.
- El backend anterior en FastAPI (`gym_coach_app/`) se retira. Queda en el historial de git y en una rama `legacy-fastapi` como referencia.

## 3. Arquitectura

Principio: tocar lo mínimo del código heredado, para poder traer mejoras de openGym con pocos conflictos.

| Unidad | Ubicación | Responsabilidad |
|---|---|---|
| Cuentas | `api/forja/accounts/` | Registro con correo, verificación, recuperación de contraseña, roles |
| Relación coach–cliente | `api/forja/roster/` | Invitaciones, altas, bajas, límite por plan |
| Asignaciones | `api/forja/assign/` | El coach escribe el plan semanal del cliente y lee sus registros |
| Asistencia | `api/forja/attendance/` | Sesiones presenciales y remotas |
| Planes | `api/forja/plans/` | Free/Pro, vencimiento, comprobación de permisos |
| Dietas | `api/forja/nutrition/` | Planes de comidas y asignación |
| Métricas | `api/forja/metrics/` | Parámetros iniciales, mediciones, fotos |
| Finanzas | `api/forja/finance/` | Mensualidades y pagos de clientes |
| Base de datos | `supabase/migrations/` | Postgres con migraciones versionadas y RLS |
| Vistas de coach | `frontend/src/views/forja/coach/` | Paneles del entrenador |
| Vistas de cliente | `frontend/src/views/forja/client/` | Paneles del cliente |

Hosting: **Vercel + Supabase**, sin servidor propio.

- **Frontend**: build estático de Vite en Vercel.
- **API**: funciones serverless de Vercel bajo `/api`.
- **Supabase Auth**: registro con correo, verificación y recuperación de contraseña.
- **Supabase Postgres**: todos los datos.
- **Supabase Storage**: fotos de progreso.

Datos:

- **Entrenamiento** (rutinas, sets, peso corporal): se conserva el documento de estado de openGym tal cual, pero guardado como una fila `jsonb` por usuario en Postgres en lugar de un archivo `state-<uid>.json`. El frontend y su sincronización no cambian de formato.
- **Usuarios, invitaciones y suscripciones push** (hoy en `db.json`, cargado en memoria): pasan a tablas de Postgres.
- **Todo lo relacional de Forja** (roles, relación coach–cliente, planes, dietas, mediciones, asistencia, pagos): tablas propias con Row Level Security.
- Los módulos de `api/forja/` solo acceden al estado de openGym a través de una única capa (`assign/`).

Consecuencia asumida: `api/server.js` de openGym es un proceso de larga vida con estado en memoria y escritura síncrona a disco (unos 20 puntos de acceso a archivos). Hay que adaptarlo a funciones sin estado y acceso asíncrono a Postgres. Es la parte más delicada del proyecto y la que más se aleja de upstream, así que va como fase propia con pruebas antes de construir encima. Límite de tasa en memoria, descarga de medios y notificaciones push programadas no funcionan igual en serverless y se rediseñan o se posponen.

Permisos: toda ruta de Forja comprueba en el servidor (a) el rol, (b) que el coach sea dueño de ese cliente y (c) que el plan permita la función. El frontend solo oculta lo que el servidor ya niega.

## 4. Cuentas y roles

- Roles: `coach`, `client`, `admin`.
- Registro de coach: correo + contraseña, con verificación por correo.
- Registro de cliente: solo por invitación de un coach (enlace con token de un solo uso y vencimiento).
- Recuperación de contraseña por correo.
- La autenticación la gestiona Supabase Auth. El login con passkey de openGym se desactiva en la primera versión.
- Un cliente pertenece a un solo coach a la vez.

## 5. Planes

Paga el coach. El cliente nunca paga a Forja.

| Función | Free | Pro |
|---|---|---|
| Clientes activos | Hasta 5 | Ilimitados |
| Rutinas, plantillas y librería de ejercicios | Sí | Sí |
| Asistencia | Sí | Sí |
| Parámetros iniciales y peso del cliente | Sí | Sí |
| Dietas | No | Sí |
| Métricas comparativas (gráficas, fotos antes/después) | No | Sí |
| Finanzas | No | Sí |

Lo que ve el cliente depende del plan de su coach:

| El cliente ve | Coach Free | Coach Pro |
|---|---|---|
| Rutina asignada y workout guiado | Sí | Sí |
| Librería de ejercicios | Sí | Sí |
| Su asistencia | Sí | Sí |
| Sus parámetros iniciales y peso | Sí | Sí |
| Dieta asignada | No | Sí |
| Comparativa de progreso | No | Sí |
| Estado de su propia mensualidad | No | Sí |

Reglas:

- El cliente nunca ve finanzas del coach ni datos de otros clientes.
- Todo es digital, en paneles y tablas. No hay exportación a PDF.
- Activación de Pro: manual. El admin registra plan y fecha de vencimiento tras recibir el pago por fuera de la app. El modelo guarda `plan` y `plan_expires_at`, independiente del medio de pago, para poder integrar una pasarela después.
- Al vencer Pro, el coach vuelve a Free. Los datos Pro no se borran: quedan ocultos. Si tiene más de 5 clientes, conserva todos en solo lectura y no puede añadir ni asignar hasta reducir o renovar.

## 6. Panel del coach

- **Inicio**: clientes activos y cupo, quién entrenó hoy, clientes inactivos, pagos por vencer (Pro).
- **Clientes**: lista, invitar, ficha con pestañas (rutina, dieta, progreso, asistencia, pagos).
- **Rutinas**: plantillas reutilizables, asignación a uno o varios clientes, ajuste por cliente. Reutiliza el editor semanal de openGym.
- **Dietas** (Pro): plan por comidas con macros.
- **Métricas** (Pro): peso, medidas y fotos por cliente contra su punto de partida.
- **Finanzas** (Pro): mensualidad por cliente, registro de pagos, vencidos, ingresos del mes.
- **Asistencia**: marca sesiones presenciales; las remotas se registran al completar un workout.

## 7. Panel del cliente

- **Onboarding**: acepta invitación, crea cuenta, carga parámetros iniciales (peso, medidas, objetivo, fotos opcionales).
- **Hoy**: rutina del día con el workout guiado; dieta si aplica.
- **Progreso**: sus registros; comparativa si aplica.
- **Asistencia**: historial y confirmación de las sesiones presenciales marcadas por el coach.
- **Mi plan**: estado de su mensualidad, si aplica.

## 8. Panel de admin

Extiende el admin de openGym: lista de coaches, plan y vencimiento de cada uno, activar o extender Pro.

## 8b. Privacidad y datos

Compromiso: los datos solo se usan para operar y mejorar Forja. No se venden ni se ceden.

- Política de privacidad y términos de uso en `docs/legal/`, enlazados en el registro y en "Acerca de". El registro exige aceptarlos.
- Sin publicidad ni rastreadores de terceros. Las métricas de mejora son agregadas y anónimas.
- Fotos de progreso opcionales, en un bucket privado con URLs firmadas de corta duración; visibles solo para el cliente y su coach.
- Row Level Security en todas las tablas: cada cuenta lee solo lo suyo; el coach, solo a sus clientes.
- El usuario puede exportar sus datos y borrar su cuenta desde la app. El borrado elimina filas y fotos.
- Si un cliente deja a su coach, el coach pierde el acceso a sus datos.
- Solo mayores de 18 años; el coach responde por la autorización de menores.

## 9. Errores

- Función fuera de plan: `403` con código `plan_required`; el frontend muestra el aviso de Pro.
- Cupo de clientes lleno: `409` con código `client_limit`.
- Invitación vencida o usada: `410`, con opción de pedir otra al coach.
- Recurso de otro coach: `404`, para no revelar que existe.

## 10. Pruebas

- Se sigue la convención de openGym: tests junto al código, `node --test` en la API y Vitest en el frontend.
- TDD en los módulos de `api/forja/`.
- Cobertura mínima obligatoria: matriz de permisos (rol × propiedad × plan) para cada ruta, y límite de 5 clientes.
- Una prueba de extremo a extremo del flujo de éxito de la sección 1.

## 11. Orden de construcción

Cada fase es usable por sí sola y tiene su propio plan de implementación y sus commits.

1. Fork (hecho: `AvilaCarlosDev/Forja`), renombrado a Forja, créditos, README.
2. Adaptación a Vercel + Supabase: almacenamiento en Postgres, API serverless, cuentas con correo y roles.
3. Relación coach–cliente e invitaciones.
4. Rutinas asignadas y asistencia.
5. Planes Free/Pro y admin.
6. Dietas, métricas y finanzas.
7. Logo e identidad visual.

## 12. Decisiones abiertas

1. **Hosting.** Decidido: Vercel + Supabase (sección 3).
2. **Envío de correo.** Decidido: Supabase Auth. Su correo integrado tiene límites bajos; para producción se configura un SMTP propio.
3. **Animaciones de ejercicios.** openGym no las redistribuye porque su titularidad está en disputa (ver su `NOTICE.md`). Antes de cobrar por el servicio hay que leer los términos del titular. NO VERIFICADO. Alternativa: lanzar sin animaciones.
4. **Nombre "Forja".** Falta verificar dominio y que no choque con otra app de fitness.
5. **Seguimiento de upstream.** openGym anuncia base de datos propia y rol "trainer" para enero–febrero de 2027. Al llegar, decidir si se adoptan o se mantiene la capa de Forja.

## 13. Fuera de alcance

Pasarela de pago automática, chat coach–cliente, apps nativas en tiendas, exportación a PDF, y el coach de IA de openGym (queda desactivado con `COACH_DISABLED=1`).
