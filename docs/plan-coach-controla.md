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

## Fases

| # | Fase | Qué incluye | Depende de |
|---|---|---|---|
| 1 | Clientes por gimnasio | Selector «Estoy en…» en Clientes con los gimnasios del entrenador. La lista se filtra por el gimnasio del cliente y se recuerda el último elegido | — |
| 2 | Avisos al cliente | 0010: avisos automáticos al guardar dieta o medidas (`diet_updated`, `metrics_added`). Los textos salen en Mi coach y en la campanita | — |
| 3 | Rutinas asignadas (la fase 2b) | 0011: tabla `assigned_routines`. El entrenador arma la rutina con el editor de openGym y se la asigna. El cliente la ve como su plan, sin poder editarla, y le llega el aviso `routine_assigned` | 2 |
| 4 | Cliente vinculado en solo lectura | Se esconden «editar rutina», «nueva medición» y «editar dieta» al cliente vinculado. La base ya bloquea medidas y dieta | 3 |
| 5 | Entrenamientos y asistencia en la nube | 0012: se sube cada entrenamiento terminado (fecha, gimnasio, duración y volumen). El entrenador ve un calendario de asistencia por cliente y cuántos vinieron por día en cada gimnasio | 3 |
| 6 | Forja Personal ($10 al mes) | 0013: plan `personal` solo para clientes sin entrenador. Da dieta propia, gráficas y comparativa. Se activa a mano tras el pago, como Pro. Hay que actualizar los términos y la página de planes | 2 |
| 7 | Cuenta del cliente | Cambiar contraseña, nombre de usuario y correo (Supabase Auth). Nada más es editable si está vinculado | 4 |

Cada fase lleva pruebas, su línea en `odd/tasks.md` y una release.
