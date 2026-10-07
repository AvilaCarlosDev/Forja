<div align="center">

<img src="assets/brand/forja-lockup.png" alt="Forja" width="520">

**La app para entrenadores personales y sus clientes.**
Rutinas, dieta, medidas, progreso y cobros del coach con sus clientes: en el teléfono y en la computadora.

[**Probar Forja →**](https://forja-trainer.vercel.app) · [Novedades](https://github.com/AvilaCarlosDev/Forja/releases) · [Plan del proyecto](docs/PLAN.md)

[![Pruebas](https://github.com/AvilaCarlosDev/Forja/actions/workflows/test.yml/badge.svg)](https://github.com/AvilaCarlosDev/Forja/actions/workflows/test.yml) ![Release](https://img.shields.io/github/v/release/AvilaCarlosDev/Forja?label=versi%C3%B3n&color=ff6b1a) ![Licencia](https://img.shields.io/badge/licencia-AGPL--3.0-111619) ![PWA](https://img.shields.io/badge/PWA-instalable-ff6b1a) ![Hecho en](https://img.shields.io/badge/hecho%20en-Punto%20Fijo%2C%20Venezuela-111619)

<br>

<img src="docs/screenshots/portada.jpg" alt="Forja en la computadora y en el teléfono: ficha de una clienta con sus medidas y la pantalla de entrada" width="100%">

</div>

## Qué hace hoy

| | Entrenador | Cliente |
|---|---|---|
| **Cuenta** | Correo y contraseña o Google; foto de perfil | Igual; menores de 18 con permiso de madre, padre o tutor |
| **Gimnasio** | Elige uno o varios donde trabaja | Elige el suyo, o «entreno en casa» |
| **Vínculo** | Recibe la solicitud como notificación y acepta o rechaza | Elige a su entrenador entre los de su gimnasio y puede cambiarlo |
| **Medidas** | Carga peso, talla, grasa corporal y visceral, masa muscular, perímetros y meta | Las ve en solo lectura; sin entrenador, carga lo básico él mismo |
| **Historial** | Al recibir a un cliente, ve todo lo que trae de su entrenador anterior | Su historial lo acompaña siempre |
| **Rutinas** | Las arma con el buscador de ejercicios (con animación): series, repeticiones, peso e indicaciones | Le llegan a su plan de la semana y las entrena tal cual |
| **Dieta** (Pro) | Comidas con alimentos por porciones, objetivos de calorías y macros, plantillas y copiar de otro cliente | La ve en Mi coach |
| **Evolución** (Pro) | Gráfica por medida con la meta y avance desde el inicio | Ve su peso y su meta en el inicio |
| **Finanzas** (Pro) | Mensualidad por cliente, pagos registrados, pendientes y vencidos | — |
| **Avisos** | Solicitudes y respuestas | «Tu coach te asignó una rutina», «te envió tu dieta», «cargó tus medidas» |
| **Plan** | Free: hasta 5 clientes · Pro: ilimitados, dieta, evolución, comparativa y finanzas | Nunca paga |

Además, todo lo que trae openGym: más de 1.300 ejercicios, planificador semanal, entrenamiento guiado y estadísticas.

**Lista inicial de gimnasios de Punto Fijo**, cada uno con fuente oficial: Gold Stars Gym (Sambil Paraguaná, Las Virtudes y Ciudad del Viento), Altitude y New Life Training Center. Si falta el tuyo, lo agregas desde la app con su Instagram o una foto del logo ([fuentes](docs/research/gimnasios-punto-fijo.md)).

## Cómo se ve

### El coach y su cliente

<table>
<tr>
<td align="center" width="33%"><img src="docs/screenshots/movil-12-rutinas.jpg" alt="Rutinas que el coach asigna a su clienta, con la animación de cada ejercicio, series, repeticiones y peso"><br><sub>Rutinas asignadas (coach)</sub></td>
<td align="center" width="33%"><img src="docs/screenshots/movil-13-evolucion.jpg" alt="Gráfica de evolución del peso con la meta y el avance desde el inicio"><br><sub>Evolución (Pro)</sub></td>
<td align="center" width="33%"><img src="docs/screenshots/movil-14-dieta.jpg" alt="Dieta del cliente: objetivos de calorías y macros y comidas con sus alimentos"><br><sub>Dieta (Pro)</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/movil-15-finanzas.jpg" alt="Finanzas del coach: cobrado, por cobrar, vencidos y pagos por cliente"><br><sub>Finanzas (Pro)</sub></td>
<td align="center"><img src="docs/screenshots/movil-16-inicio-cliente.jpg" alt="Inicio de la clienta: entrenamiento de hoy asignado por su coach y su peso con la meta"><br><sub>Inicio del cliente</sub></td>
<td align="center"><img src="docs/screenshots/movil-17-plan-cliente.jpg" alt="Plan semanal de la clienta con las rutinas que le asignó su coach"><br><sub>Plan de la semana (cliente)</sub></td>
</tr>
</table>

### En el teléfono

<table>
<tr>
<td align="center" width="25%"><img src="docs/screenshots/movil-01-entrar.jpg" alt="Pantalla de entrada con video de un entrenador y su clienta"><br><sub>Entrar</sub></td>
<td align="center" width="25%"><img src="docs/screenshots/movil-04-gimnasio.jpg" alt="Elegir gimnasio de Punto Fijo"><br><sub>Elegir gimnasio</sub></td>
<td align="center" width="25%"><img src="docs/screenshots/movil-05-entrenador.jpg" alt="Elegir entrenador del gimnasio"><br><sub>Elegir entrenador</sub></td>
<td align="center" width="25%"><img src="docs/screenshots/movil-03-instalar.jpg" alt="Pasos para instalar Forja en iPhone"><br><sub>Instalar como app</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/movil-06-clientes.jpg" alt="Pestaña Clientes del entrenador con notificaciones y solicitudes"><br><sub>Clientes (entrenador)</sub></td>
<td align="center"><img src="docs/screenshots/movil-07-ficha-cliente.jpg" alt="Ficha de una clienta con medidas, meta y avance"><br><sub>Ficha del cliente</sub></td>
<td align="center"><img src="docs/screenshots/movil-08-mi-coach.jpg" alt="Mi coach: gimnasio, entrenador y medidas en solo lectura"><br><sub>Mi coach (cliente)</sub></td>
<td align="center"><img src="docs/screenshots/movil-02-crear-cuenta.jpg" alt="Crear cuenta como Personal Trainer o Cliente"><br><sub>Crear cuenta</sub></td>
</tr>
</table>

**Completar el perfil** — la primera vez que se entra:

<table>
<tr>
<td align="center" width="33%"><img src="docs/screenshots/movil-09-perfil.jpg" alt="Tus datos: foto de perfil, nombre, sexo y fecha de nacimiento"><br><sub>Foto y datos</sub></td>
<td align="center" width="33%"><img src="docs/screenshots/movil-10-tutor.jpg" alt="Menor de edad: permiso de madre, padre o tutor"><br><sub>Menores: permiso del tutor</sub></td>
<td align="center" width="33%"><img src="docs/screenshots/movil-11-tipo-de-cuenta.jpg" alt="Cuenta creada con Google: elegir Personal Trainer o Cliente y aceptar los términos"><br><sub>Entrar con Google: tipo de cuenta</sub></td>
</tr>
</table>

### En la computadora

<table>
<tr>
<td width="50%"><img src="docs/screenshots/pc-01-entrar.jpg" alt="Pantalla de entrada en la computadora"></td>
<td width="50%"><img src="docs/screenshots/pc-06-clientes.jpg" alt="Clientes del entrenador en la computadora"></td>
</tr>
<tr>
<td><img src="docs/screenshots/pc-07-ficha-cliente.jpg" alt="Ficha del cliente en la computadora"></td>
<td><img src="docs/screenshots/pc-08-mi-coach.jpg" alt="Mi coach en la computadora"></td>
</tr>
</table>

<sub>Capturas de la versión 0.8 con datos de ejemplo. Se regeneran con <code>scripts/forja-screenshots.mjs</code>.</sub>

## Instálala en tu teléfono

Forja es una app web instalable (PWA): no hace falta tienda.

- **iPhone (Safari):** Compartir → **Agregar a inicio**.
- **Android (Chrome):** botón **Instalar Forja** en la pantalla de entrada, o menú ⋮ → **Instalar app**.

## Privacidad y seguridad

- Los datos se usan solo para operar y mejorar Forja. No se venden ni se ceden; sin publicidad ni rastreadores.
- Cada tabla tiene **seguridad por fila** en Postgres: un entrenador solo ve a sus clientes activos, y el anterior pierde el acceso al cambiar de entrenador. Las reglas tienen pruebas automáticas que corren contra la base ([`supabase/tests`](supabase/tests)).
- La otra parte de un vínculo solo lee las columnas públicas del perfil; el perfil propio completo llega por una función de la base.
- Fotos de perfil en almacenamiento privado, una carpeta por persona.
- Cabeceras de seguridad en Vercel: CSP sin código en línea, `frame-ancestors 'none'`, HSTS, nosniff y Referrer-Policy.
- Términos y política de privacidad aceptados al crear la cuenta y al entrar.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite, PWA (heredado de openGym), sin SDK de Supabase: REST con `fetch` |
| Cuentas y datos | Supabase: Auth, Postgres con RLS, Storage |
| Hosting | Vercel |
| Pruebas | Vitest (3.300+ tests, 160 propios de Forja) y 109 pruebas de permisos SQL en Supabase y en PGlite |

## Desarrollo

```bash
cd frontend
npm ci
npm test           # usar Node 22 (con Node 26 fallan tests en falso por localStorage)
npm run dev
```

Vista previa sin servidor (cuentas y datos de ejemplo en el navegador):

```bash
VITE_FORJA_AUTH_PREVIEW=1 npx vite
```

Sesiones demo con meses de datos (un coach Pro y una clienta): `node scripts/forja-demo-sessions.mjs` y abrir `/demo/cargar-sesiones.html` con el servidor de desarrollo. No llegan a producción.

Base de datos: las migraciones están en [`supabase/migrations`](supabase/migrations) y se aplican en orden en el editor SQL de Supabase. Para probar los permisos en local: `node supabase/tests/run-local.mjs` (con PGlite instalado).

## Documentación

- [Plan del proyecto por fases](docs/PLAN.md) · [Tareas y evidencia](odd/tasks.md)
- [Diseño](docs/superpowers/specs/2026-10-06-forja-design.md) · [Video de entrada](docs/design/login-video.md)
- [Privacidad](docs/legal/PRIVACIDAD.md) · [Términos](docs/legal/TERMINOS.md) (borradores)

## Basado en openGym

Forja es un fork de [**openGym**](https://github.com/DuarteSantos8/openGym), de Duarte Santos, un tracker de gimnasio autoalojado. De openGym vienen la librería de ejercicios, el planificador semanal, el workout guiado, las estadísticas y la PWA. Su README original se conserva en [`docs/upstream/README.openGym.md`](docs/upstream/README.openGym.md). Forja añade la capa de entrenador: cuentas, gimnasios, vínculo coach–cliente, medidas y planes.

## Licencia y créditos

Forja se distribuye bajo **GNU AGPL-3.0**, la misma licencia de openGym, de la que es obra derivada. Ver [`LICENSE`](LICENSE) y [`NOTICE.md`](NOTICE.md).

- openGym — Copyright (C) 2026 Duarte Santos.
- Modificaciones de Forja — Copyright (C) 2026 Carlos Ávila.
- Video de la pantalla de entrada: [Mixkit](https://mixkit.co/free-stock-video/mature-woman-working-out-with-her-trainer-47023/), licencia libre de Mixkit.

Los datos e imágenes de ejercicios son de terceros y tienen sus propias condiciones, detalladas en `NOTICE.md`.
