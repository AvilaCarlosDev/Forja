# Plan: el entrenador controla, el cliente recibe (pedido 2026-10-07)

## Reglas

- **El entrenador trabaja por gimnasio.** Elige en qué gimnasio está ahora (uno de los suyos) y ve solo los clientes vinculados con él en ese gimnasio. Si en la tarde se cambia a otro gimnasio, la lista cambia a los clientes de ese otro.
- **Con un vínculo activo, todo lo controla el entrenador:** asigna la rutina y la dieta, y anota las medidas. Con eso se arman las gráficas en el perfil del cliente.
- **El cliente vinculado solo lee** su rutina, su dieta, sus medidas y sus gráficas. En su cuenta solo cambia la contraseña, el nombre de usuario y el correo. Registra sus entrenamientos con la rutina que le asignaron.
- **Avisos:** cuando el entrenador le asigna rutina o dieta, o le carga medidas, al cliente le llega una notificación («Tu coach te envió…»).
- **Asistencia:** el entrenador ve qué días vino cada cliente y cuántos vinieron por día a cada gimnasio.
- **Planes** (`docs/PLAN.md`):
  - El cliente ve lo que permite el plan de su entrenador.
  - Con entrenador Free, el cliente ve sus rutinas y sus medidas actuales.
  - Con entrenador Pro, ve además la dieta, la gráfica de evolución y la comparativa.
  - Sin entrenador, el cliente puede pagar **Forja Personal** ($10 al mes) y controlar todo él mismo: rutinas, dieta, medidas y gráficas.

## Rutinas y dieta según el tipo de cuenta (pedido 2026-10-07)

| Cuenta | «Entrenar» y rutinas | Dieta | Medidas y gráficas |
|---|---|---|---|
| Cliente sin coach, Free | Arma su rutina como en openGym: elige ejercicios, peso, repeticiones y series | No | Carga su peso y medidas básicas. Sin gráfica de evolución |
| Cliente sin coach, **Forja Personal** | Igual que Free, la arma él | Arma su propia dieta, **sin copiar ni usar la de nadie** | Todo, con gráficas y comparativa |
| Cliente con coach Free | Ve la rutina que le asignó su coach | No | Ve las medidas actuales que carga el coach |
| Cliente con coach **Pro** | Ve la rutina que le asignó su coach | Ve la dieta que le armó su coach | Todo, con gráficas y comparativa |
| Coach Free | Asigna rutinas | No | Carga medidas |
| Coach **Pro** | Asigna rutinas | Arma dietas, con plantillas y copiando la de otro cliente | Todo |

- **Rutina asignada en la app del cliente:** al tocar «Entrenar» (o en Plan) ve la rutina de su coach. Cada ejercicio muestra su imagen o video de cómo se hace, junto con el peso, las repeticiones y las series que indicó el coach. Por ejemplo, «Jalón al pecho» y «Tríceps en polea»: al tocar uno se abre su imagen con la indicación.
- **Aviso:** cuando el coach le asigna o cambia la rutina, al cliente le llega `routine_assigned` («Tu coach te asignó una rutina») y la rutina aparece en Plan y en «Entrenar».
- **El peso se pide una sola vez, al completar el perfil**, junto con la talla (opcional). Es el primer pesaje y la primera medida. En Forja ya no se pide antes de cada entrenamiento.

## Fases

| # | Fase | Qué incluye | Depende de |
|---|---|---|---|
| 1 | Clientes por gimnasio | Selector «Estoy en…» en Clientes con los gimnasios del entrenador. La lista se filtra por el gimnasio del cliente y se recuerda el último elegido | — |
| 2 | Avisos al cliente | 0010: avisos automáticos al guardar dieta o medidas (`diet_updated`, `metrics_added`). Los textos salen en Mi coach y en la campanita | — |
| 3 | Rutinas asignadas (la fase 2b) | 0011: tabla `assigned_routines`. El entrenador arma la rutina con el editor de openGym y se la asigna. El cliente la ve como su plan, sin poder editarla, y le llega el aviso `routine_assigned` | 2 |
| 4 | Cliente vinculado en solo lectura | Se esconden «editar rutina», «nueva medición» y «editar dieta» al cliente vinculado. La base ya bloquea medidas y dieta | 3 |
| 5 | Marcar asistencia | 0012: la tarjeta «Marcar asistencia» reemplaza al check-in con QR de openGym, que se esconde desde el 2026-10-07 porque los gimnasios de Punto Fijo no tienen lector. El cliente toca «Llegué a ‹gimnasio›», con el logo de la tarjeta del gimnasio, y queda su asistencia del día (también se marca sola al empezar un entrenamiento). Al entrenador le llega el aviso `client_arrived` («María llegó a Gold Stars Sambil»), para que sepa que fue y, si no está en el gimnasio, le asigne la rutina desde la app. El entrenador ve el calendario de asistencia por cliente y quién vino hoy en cada gimnasio. Se suben los entrenamientos terminados (fecha, gimnasio, duración y volumen) | 3 |
| 6 | Forja Personal ($10 al mes) | 0013: plan `personal` solo para clientes sin entrenador. Da dieta propia, gráficas y comparativa. Se activa a mano tras el pago, como Pro. Hay que actualizar los términos y la página de planes | 2 |
| 7 | Cuenta del cliente | Cambiar contraseña, nombre de usuario y correo (Supabase Auth). Nada más es editable si está vinculado | 4 |

Cada fase lleva pruebas, su línea en `odd/tasks.md` y una release.
