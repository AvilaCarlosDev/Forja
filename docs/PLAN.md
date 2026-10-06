# Forja — plan del proyecto

Actualizado: 2026-10-06 · Dueño: Carlos Ávila · Rama de trabajo: `forja/fase-1`

Este documento es el mapa: de dónde venimos, dónde estamos y qué falta, en orden. El detalle técnico vive en `docs/superpowers/specs/2026-10-06-forja-design.md` y el estado tarea por tarea en `odd/tasks.md`.

## 1. Qué es Forja

App web (PWA) para **personal trainers y sus clientes**, presencial o a distancia.

- **El entrenador** crea y asigna rutinas y dietas, registra las métricas corporales de cada cliente, lleva asistencia y controla sus cobros.
- **El cliente** tiene su cuenta, ejecuta sus rutinas, ve su dieta y su progreso.
- **Modelo**: open source (AGPL-3.0). Paga solo el entrenador: plan Free hasta 5 clientes, plan Pro con clientes ilimitados, dietas, métricas comparativas y finanzas. El cliente nunca paga y ve lo que permite el plan de su entrenador.
- **Privacidad**: los datos se usan solo para operar y mejorar la app. No se venden ni se ceden.

## 2. Cómo empezamos

| Decisión | Qué se resolvió |
|---|---|
| Punto de partida | El repo `gym-coach-client` (FastAPI + plantillas HTML) quedó como referencia. No se reutiliza su código. |
| Base técnica | Fork de [openGym](https://github.com/DuarteSantos8/openGym): React 19 + Vite, 1.324 ejercicios, workout guiado, estadísticas, PWA. |
| Licencia | AGPL-3.0, obligatoria por ser obra derivada. Se puede cobrar por el servicio alojado; el código queda público. |
| Nombre y marca | **Forja** ("forja tu cuerpo"). Logo: torso levantando una barra. Fondo `#111619`, naranja `#FF6B1A`, ámbar `#FFB238`, hueso `#F4F1EC`. |
| Hosting | Vercel (frontend y funciones) + Supabase (cuentas, base de datos, fotos). Sin servidor propio. |
| Cobro del Pro | Manual al inicio: el entrenador paga por fuera y el admin activa el Pro con fecha de vencimiento. |

## 3. Dónde estamos

| Fase | Contenido | Estado |
|---|---|---|
| 0. Diseño | Spec, planes, política de privacidad y términos | **Hecho** |
| 1. Identidad | Fork, nombre, logo, iconos, colores, créditos, README | **Hecho** (en la rama, sin fusionar) |
| 2a. Cuentas | Registro, login, recuperación, elegir Personal Trainer o Cliente, sexo | **Código hecho, sin conectar a Supabase** |
| 2b. Datos en la nube | Guardar el entrenamiento en Supabase | Pendiente |
| 3. Gimnasios y vínculo | Lista de gimnasios, elegir entrenador, cambiarlo | Pendiente |
| 4. Rutinas y asistencia | El entrenador asigna, el cliente ejecuta | Pendiente |
| 5. Métricas corporales | Peso, talla, grasa corporal y visceral, composición | Pendiente |
| 6. Planes y admin | Free/Pro y activación manual | Pendiente |
| 7. Dietas y finanzas | Funciones Pro | Pendiente |
| 8. Lanzamiento | Dominio, correo, revisión legal, pruebas con usuarios reales | Pendiente |

Lo que se puede ver hoy: la vista previa abre con las pantallas de entrar y crear cuenta, y dentro está openGym con la marca Forja y datos de ejemplo. Las cuentas de la vista previa son de prueba y viven solo en el navegador.

## 4. Fases que faltan, en detalle

Cada fase termina en algo que se puede usar y probar. Ninguna se da por cerrada sin evidencia (tests y recorrido en navegador).

### Fase 2a — Cuentas (cerrar)

Falta conectar lo ya construido.

1. Carlos revisa qué hay en el proyecto Supabase "Gymcoach" con `supabase/migrations/0000_revisar_y_limpiar.sql` (paso 1, solo lectura).
2. Carlos borra lo viejo (paso 2 del mismo archivo). **Borra datos y no se deshace.**
3. Carlos ejecuta `0001_forja_profiles.sql` (tabla de perfiles, alta automática, seguridad por fila).
4. En Supabase → Authentication: activar confirmación por correo y poner la URL del sitio.
5. Crear el proyecto en Vercel apuntando a `frontend/`, con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
6. Probar de punta a punta: registro, correo de confirmación, login, recuperación de contraseña, cerrar sesión.

**Hecho cuando**: una persona real crea su cuenta desde la URL de Vercel y vuelve a entrar al día siguiente.

### Fase 2b — Datos en la nube

Hoy el entrenamiento se guarda en el dispositivo. Aquí pasa a Supabase.

- Tabla con el estado de entrenamiento de cada usuario (una fila por persona, mismo formato de openGym).
- Sincronización: al entrar se descarga, al cambiar se sube, con el mismo control de conflictos que ya trae openGym.
- Es la parte más delicada del proyecto: va con tests antes de construir nada encima.

**Hecho cuando**: el mismo usuario ve sus datos en el teléfono y en la computadora.

### Fase 3 — Gimnasios y vínculo entrenador–cliente

**Gimnasios**

- Tabla `gyms` (nombre, ciudad, dirección, red social, verificado).
- Lista inicial: gimnasios de la ciudad de Punto Fijo. Sale de una investigación con fuente primaria por cada uno (su cuenta o página oficial); lo que no se pueda verificar no entra.
- Al registrarse, entrenador y cliente eligen su gimnasio. Opciones extra: "Entreno a distancia / en casa" y "Mi gimnasio no está", que lo propone para revisión del admin.
- Ambos pueden cambiar de gimnasio desde su perfil.

**Vínculo**

- Al registrarse, el cliente puede elegir a su entrenador de una lista (filtrable por gimnasio) o dejarlo para después.
- Elegir crea una **solicitud**; el entrenador la acepta o la rechaza. Sin este paso, cualquiera podría colgarse de un entrenador y gastarle sus 5 cupos del plan Free.
- El cliente puede cambiar de entrenador desde su perfil. Un cliente tiene un solo entrenador a la vez.
- La lista pública de entrenadores muestra solo nombre y gimnasio.

**Hecho cuando**: un cliente elige entrenador, este lo acepta y lo ve en su lista; el cliente cambia a otro y el primero deja de verlo.

### Fase 4 — Rutinas y asistencia

- Solo el entrenador crea y asigna rutinas a sus clientes. El cliente vinculado las ejecuta con el workout guiado y no las edita.
- Plantillas reutilizables, asignables a uno o varios clientes.
- El entrenador ve en solo lectura lo que su cliente registró.
- Asistencia en ambos perfiles: el entrenador marca la sesión presencial y el cliente la confirma; las remotas se registran al completar el workout.

Decisión abierta: si un cliente **sin** entrenador puede crear sus propias rutinas. Propuesta: sí, para que la app le sirva desde el primer día; al vincularse, manda el entrenador.

**Hecho cuando**: el entrenador asigna una rutina, el cliente la completa desde su teléfono y el entrenador ve el registro.

### Fase 5 — Métricas corporales

- El entrenador registra por cliente: peso, talla, % de grasa corporal, grasa visceral, masa muscular, composición corporal y medidas. El cliente carga sus parámetros iniciales.
- **Las métricas son del cliente, no del entrenador.** Al cambiar de entrenador, todo el historial viaja con el cliente: el nuevo ve cómo lo recibió y sigue el progreso. El anterior pierde el acceso.
- Cada registro guarda quién lo cargó y cuándo.
- Vista de comparativa (inicio contra hoy, gráficas): función Pro.
- Son datos sensibles: solo los ven el cliente y su entrenador actual.

**Hecho cuando**: un cliente con historial cambia de entrenador y el nuevo ve todas sus mediciones anteriores.

### Fase 6 — Planes y admin

- Free: hasta 5 clientes activos. Pro: ilimitados y funciones Pro.
- El servidor hace cumplir los límites; el frontend solo los refleja.
- Panel de admin: lista de entrenadores, activar o extender el Pro, revisar gimnasios propuestos.
- Al vencer el Pro, el entrenador vuelve a Free sin perder datos: quedan ocultos.

**Hecho cuando**: el sexto cliente de un entrenador Free queda en espera, y al activarle el Pro entra.

### Fase 7 — Dietas y finanzas (Pro)

- Dietas: plan por comidas con macros, asignable como las rutinas.
- Finanzas: mensualidad por cliente, pagos, vencidos, ingresos del mes. El cliente ve solo el estado de su propia mensualidad.

**Hecho cuando**: un entrenador Pro asigna una dieta y registra un pago, y su cliente ve ambos.

### Fase 8 — Lanzamiento

- Dominio propio y correo del proyecto; SMTP propio en Supabase (el integrado tiene límites bajos).
- Revisión legal de política y términos antes de cobrar.
- Resolver las animaciones de ejercicios (derechos sin aclarar) o lanzar sin ellas.
- Prueba con 2 o 3 entrenadores reales de Punto Fijo.
- Fusionar a `main` y publicar.

## 5. Quién ve qué

| | Entrenador Free | Entrenador Pro | Cliente de Free | Cliente de Pro |
|---|---|---|---|---|
| Rutinas | Crea y asigna | Crea y asigna | Ejecuta | Ejecuta |
| Asistencia | Sí | Sí | Sí | Sí |
| Métricas básicas (peso, parámetros iniciales) | Sí | Sí | Sí | Sí |
| Comparativa de progreso | No | Sí | No | Sí |
| Dietas | No | Sí | No | Sí |
| Finanzas | No | Sí | No | Solo su mensualidad |
| Clientes | Hasta 5 | Ilimitados | — | — |

## 6. Qué necesita hacer Carlos

Por orden, lo que desbloquea más trabajo primero.

1. **Dar permiso de escritura al repo** a la sesión de trabajo. Hoy cada cambio se sube archivo por archivo desde el navegador.
2. **Supabase**: correr los dos SQL de la fase 2a y pasar la URL del proyecto y la clave pública.
3. **Vercel**: crear el proyecto y cargar las variables de entorno.
4. **Revisar y fusionar** `forja/fase-1` a `main` dentro de `AvilaCarlosDev/Forja` (no hacia openGym).
5. **Crear el correo** del proyecto.
6. **Decidir** los tres puntos abiertos de la sección 7.

## 7. Decisiones abiertas

1. ¿El entrenador debe **aceptar** al cliente que lo elige? Propuesta: sí.
2. ¿Un cliente sin entrenador puede crear sus propias rutinas? Propuesta: sí.
3. ¿El sexo se queda en dos opciones? Hoy son Hombre y Mujer; se usa para el mapa muscular y las referencias de progreso.

## 8. Riesgos conocidos

- **Fase 2b** cambia la parte más delicada de openGym y nos aleja de su código: más trabajo al traer sus mejoras.
- **openGym planea** base de datos propia y rol "trainer" para inicios de 2027; habrá que decidir si se adopta.
- **Cobro desde Venezuela**: sin pasarela automática por ahora.
- **Tests heredados intermitentes**: `CoachChat.demo-failure` y `useStore.media` fallan en algunas corridas con el mismo código. Sin diagnosticar.
- **Idioma**: la app aún arranca en inglés en algunos navegadores; el español se elige en Ajustes. Por corregir.
