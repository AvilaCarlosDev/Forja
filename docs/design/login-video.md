# D0 — Video de entrada: investigación, fuentes y auditoría de BUZZY

Fecha: 2026-10-06. Alcance: **investigación y propuesta; cero créditos gastados, cero logins en BUZZY**.
Resultado corto: el hero del login va con **video stock real (gratis, comercial, sin marca de agua)**;
BUZZY queda como capa opcional de marca y solo con aprobación expresa de Carlos.

## 1. Qué se busca en la pantalla de entrar

Loop silencioso de personas entrenando, con oscurecido para que el formulario se lea bien.
Patrón de los ejemplos revisados (8 referencias):

| Referencia | Qué aporta |
|---|---|
| FitLife App Onboarding — dribbble.com/shots/24394787 | Saludo + motivo en 2-3 paneles, sin video, ilustrado |
| Fitness app onboarding (Otto Panczel) — dribbble.com/shots/18312360 | Formulario de metas como primer paso |
| Splash fitness launch — dribbble.com/shots/23155989 | Animación de entrada de marca, dark + acento |
| FitBuddy iOS onboarding — contra.com/p/MNkRgMQP | Onboarding = primer paso hacia la meta, no un formulario |
| Hero explorations (fitness) — contra.com/p/OW7rOrk2 | Hero con foto/ambientación y CTA claro |
| ASHGYM landing — dribbble.com/shots/21721200 | Hero foto + titular potente, paleta oscura con acento |
| FitFlow hero (Envato) — elements.envato.com/fitflow-…-4XT2DBA | Hero visual-first, stats que miden progreso |
| Tag fitness-onboarding — dribbble.com/tags/fitness-onboarding | Convención dominante: oscuro + acento cálido, foto/video real de gimnasio |

Lectura de ritmo (convención de la categoría, no de un solo ejemplo):

- Duración del loop: **6-10 s**, cortes de 1-2 s o un plano continuo lento; nada de siete cortes por segundo.
- Siempre **silencioso** (`muted autoplay loop playsinline`), con `poster` fotográfico.
- Overlay oscuro encima (el login de Forja es `#111619`): el video se siente, no compite.
- **`prefers-reduced-motion`** → foto fija. Y fallback: si el video no carga, queda el `poster`.
- Peso objetivo **≤ 1,5 MB** (mp4 h264 + poster webp); precarga `metadata`, no más.

## 2. Fuentes de video stock (base del hero) — gratis y uso comercial

| Fuente | Colección fitness | Licencia | Marca de agua | Atribución |
|---|---|---|---|---|
| Mixkit (mixkit.co/free-stock-video/fitness/) | 718 clips 4K/HD | Mixkit Free License: comercial y personal, sin reventa del clip tal cual | No | No |
| Pexels (pexels.com/search/videos/gym/) | ~1.300 clips | Free to use, uso comercial | No | No |
| Pixabay (pixabay.com/videos/search/fitness/) | 586+ clips | Royalty-free, uso libre | No | No |
| Coverr (coverr.co/stock-video-footage/fitness) | Fitness 4K (real + AI) | Royalty-free, comercial, revisado uno a uno | No | No |

Ya localizados como candidatos: `mixkit.co/free-stock-video/woman-while-is-in-her-workout-in-gym-setting-100521/` (16 s),
`mixkit.co/free-stock-video/treadmill-workout-in-black-and-white-100531/` (13 s), y los de "neon-lit gym" / "weight machines" de Pexels.
Selección final: recorte 6-10 s + overlay de marca; **no** usar clip con logos/ropa de gimnasios ajenos.

## 3. Auditoría BUZZY (buzzy.now) — verificado contra sus Términos (§2 y §5.1) y ToolChase (30-09-2026)

| Dato | Valor confirmado |
|---|---|
| Gratis | Los **primeros 2 videos** al registrarse (sin tarjeta). Las fuentes que hablan de "50 créditos" no coinciden con los Términos: ToolChase los marca como rumor no publicado. |
| Costo | **10 créditos por segundo** (ejemplo oficial: 5 s = 50). Salidas: 3 s = 30, 10 s = 100, 15 s = 150 créditos. |
| Con los "10 créditos" que tiene la cuenta | **No alcanza ni 1 segundo** (0,9 s). Inútil para el hero. |
| Marca de agua | Export libre **con marca de agua**; sin marca de agua = feature Pro. |
| Licencia libre | **Solo uso personal/no comercial** (§2). Para promocionar Forja con fines de pago, eso **no sirve**. |
| Licencia con plan pago | **No confirmada por escrito**: los Términos no dicen que el plan incluya derechos comerciales. nemovideo recomienda confirmarlo con soporte antes de usar salidas en anuncios. |
| Planes (publicados 30-09-2026) | Basic $19/mes ($11.50/mes anual = $138/año, 2.000 créd.) · Pro $34/mes ($20/mes anual = $240/año, 3.600) · Ultra $56/mes (6.000) · Infinite $169/mes (20.000). |
| Otras reglas | Los créditos **no se acumulan** y caducan al cerrar ciclo; al cancelar vuelven a 0. El propio proveedor admite que "lograr el plano correcto lleva varios intentos": presupuestar los retakes. |

**Conclusión D0:** con la cuenta actual (10 créditos o incluso los 2 videos libres) no se produce nada usable
(marca de agua + licencia no comercial). Un hero generado en BUZZY exigiría plan de pago + confirmación de
derechos comerciales por escrito + presupuesto de retakes. **Para la v1: stock real. BUZZY queda postergado.**

## 4. Prompts en borrador (no ejecutar sin el OK de Carlos)

Pensados para el día que haya plan pago + licencia comercial confirmada. Formato de la casa:
sujeto → acción → ambiente → luz → movimiento de cámara.

1. `Un atleta de 30 años levantando una barra en un gimnasio industrial, luz cenital cálida y humo leve, plano medio fijo con lento push-in, 3 segundos, sin texto`
2. `Mujer terminando una serie de press de banca y soltando la barra, gimnasio oscuro con luces ámbar, cámara lateral en travelling lento, 3 segundos, sin texto`
3. `Detalle de manos en agarrando una barra con magnesio, polvo suspendido, luz de lado dura, plano fijo, 3 segundos, sin texto`

Ninguno se ejecuta hasta que Carlos: (a) audite saldo real en buzzy.now, (b) apruebe prompt, (c) confirme licencia comercial.

## 5. Próximo paso propuesto

1. Elegir 2-3 clips stock (Mixkit/Pexels), recortarlos y probar overlay + poster en el login — sin tocar BUZZY.
2. Guardar el poster ya recortado en `frontend/public/` cuando Carlos apruebe la selección.

## Decisión final (2026-10-06): video de stock

El clip generado en Buzzy falló (`TASK_STATE_FAILED`, sin archivo). Se usa stock gratis:

- Clip: [Mixkit 23261 — "Man lifting weights supported by his trainer"](https://mixkit.co/free-stock-video/man-lifting-weights-supported-by-his-trainer-23261/). Licencia Mixkit Stock Video Free: uso comercial, sin atribución obligatoria ([info oficial](https://mixkit.co/llm-info/)).
  Elegido porque muestra lo que es Forja: un entrenador acompañando y corrigiendo a su cliente (pedido de Carlos). Luz cálida lateral sobre fondo oscuro, a juego con la marca. Descartados: 52094 (alguien entrenando solo), 47023 (el coach solo mira), 23345 y 23940 (más fríos).
- Bucle de 8 s sin corte: segundos 3–11 del clip con fundido de 1 s del final al principio (`xfade`).
- Archivos en `frontend/public/forja/`: `login.webm` (VP9, 825 KB), `login.mp4` (H.264, 1,1 MB), `login-poster.jpg` (33 KB).
- `views/forja/Auth.jsx` (`AuthBackdrop`): imagen fija primero, video tras la primera pintura, nada de video con `prefers-reduced-motion` o ahorro de datos, pausa con la pestaña oculta. Capa oscura y formulario con fondo translúcido; siempre en oscuro aunque la app esté en modo claro.
