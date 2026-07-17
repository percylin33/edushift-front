# Guía de pruebas — Administrador de la plataforma (SUPER_ADMIN)

**Para quién es esta guía:** personas que van a probar la plataforma como si fueran el/la administrador(a) global de EduShift (no de un colegio, sino de toda la plataforma).
**Qué necesitas antes de empezar:**
- Una cuenta de super-administrador activa (`super@edushift.pe`).
- Acceso al entorno donde el equipo de desarrollo habilita el bypass de verificación en dos pasos (solo en ambientes de prueba).
- Al menos un colegio activo, uno suspendido y un plan "empresarial" creados en el sistema para validar las listas.

**Importante:** este rol maneja cosas que afectan a varios colegios a la vez. Algunas acciones (suspender un colegio, impersonar a un usuario) son delicadas. Cuando veas una confirmación, **léela antes de aceptar**.

---

## Índice de funcionalidades

| # | Funcionalidad | Cosas que vas a probar |
|---|---|---|
| F1 | Iniciar sesión como super-admin | Login normal y bypass de MFA (solo en desarrollo) |
| F2 | Ver el panel principal | Las 7 tarjetas y gráficos de estadísticas |
| F3 | Ver la lista de colegios | Buscar, filtrar, paginar |
| F4 | Ver el detalle de un colegio | Sus datos, usuarios, suscripción, métricas |
| F5 | Suspender un colegio | Lo que pasa con su sesión y con sus usuarios |
| F6 | Reactivar un colegio | Volver a permitir el acceso |
| F7 | Suplantar a un usuario (impersonación) | Entrar como otro usuario para dar soporte |
| F8 | Ver el registro de auditoría | Quién hizo qué, cuándo, en qué colegio |

---

## F1. Iniciar sesión como super-admin

**Qué vamos a probar:** que el inicio de sesión sea seguro pero práctico en el día a día.

### Antes de empezar
- Tener tu cuenta (`super@edushift.pe`) activa.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la pantalla de login de super-admin (es una entrada distinta, normalmente `/admin/login`). | Ves un formulario de inicio de sesión. |
| 2 | Escribe tu email y tu contraseña. | Las casillas aceptan el texto. |
| 3 | Pulsa "Ingresar". | Te lleva a una pantalla para configurar tu segundo factor (código del celular). |
| 4a | (En producción) Abre tu app de autenticación (Google Authenticator, Authy, etc.), escanea el código QR y escribe el número de 6 dígitos. | La plataforma acepta el código y te lleva al panel. |
| 4b | (En desarrollo, si está habilitado el bypass) Pulsa el botón "Bypass MFA dev". | Te lleva directamente al panel sin pedir código. |

### Qué está pasando por dentro (en simple)
Los super-administradores tienen acceso a datos sensibles de todos los colegios. Por eso la plataforma les pide un **doble factor de autenticación**: además de la contraseña, hay que probar que tienes tu celular a mano. El bypass solo existe en entornos de prueba y **nunca debe estar activo en producción**. Si encuentras el botón de bypass en producción, es un fallo grave.

### Cosas que pueden salir mal
- Escribes mal la contraseña → ves "Credenciales inválidas".
- El código de tu app expira a los 30 segundos → espera uno nuevo y vuelve a intentarlo.
- El bypass no aparece y estás en desarrollo → falta activarlo en la configuración (avisa al equipo técnico).

---

## F2. Ver el panel principal (con las estadísticas)

**Qué vamos a probar:** que las cifras globales (dinero, colegios activos, estudiantes) sean correctas y que los filtros funcionen.

### Antes de empezar
- Sesión iniciada como super-admin.
- El cron de actualización de métricas debe haber corrido al menos una vez (suele correr cada hora).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre el panel principal de super-admin (`/admin/dashboard`). | Ves varias tarjetas con números grandes (ingresos mensuales, colegios activos, planes vendidos). |
| 2 | Mira la tarjeta "MRR total" (ingresos mensuales recurrentes). | El número debe cuadrar con: (suscripciones activas) × (precio mensual del plan). |
| 3 | Mira la gráfica de "Revenue mensual" (línea de los últimos meses). | Ves una curva con al menos 6 puntos. |
| 4 | Mira la gráfica "Tenantes activos" (cuántos colegios están pagando ahora). | La curva debería verse creciente si la plataforma está creciendo. |
| 5 | Mira el gráfico circular "Distribución de planes". | Las porciones suman 100% (todos los colegios clasificados). |
| 6 | Pulsa "Top 10 colegios" para ver un ranking. | Ves una tabla con 10 colegios, ordenados de mayor a menor ingreso. |
| 7 | Mira "Cobrado vs vencido" (cuánto se cobró vs cuánto se debió cobrar). | Ves dos cifras comparables. |
| 8 | Mira "Estudiantes por plan". | Ves cuántos estudiantes tiene cada plan. |
| 9 | Cambia el filtro "Período" a "Últimos 12 meses". | Todas las cifras se recalculan. |

### Qué está pasando por dentro (en simple)
Todas estas cifras se calculan con datos reales (no son números inventados para verse bonitos). Si una tarjeta muestra `0` cuando debería mostrar algo, probablemente es porque el cron que actualiza las métricas no ha corrido o el cálculo falló en silencio. **Si algo no cuadra, anótalo y repórtalo** — puede ser un indicador temprano de un problema mayor.

### Cosas que pueden salir mal
- Si nunca se han calculado las métricas → las gráficas aparecen vacías con un mensaje "Sin datos aún".

---

## F3. Ver la lista de colegios

**Qué vamos a probar:** que puedas encontrar cualquier colegio aunque haya cientos, usando los filtros y la búsqueda.

### Antes de empezar
- Sesión iniciada como super-admin.
- Tener al menos 3 colegios creados con planes y estados distintos.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre "Colegios" en el menú de super-admin. | Ves una tabla con todos los colegios, paginada (20 por página). |
| 2 | Escribe "demo" en el buscador. | La tabla se filtra para mostrar solo los colegios cuyo nombre contiene "demo". |
| 3 | Filtra por estado "Suspendido". | Solo aparecen los suspendidos. |
| 4 | Filtra por plan "Empresarial". | Solo aparecen los que tienen ese plan. |
| 5 | Combina los tres filtros (búsqueda + estado + plan). | La tabla muestra solo los colegios que cumplen todas las condiciones. |
| 6 | Cambia "Mostrar 20" a "Mostrar 50". | La tabla ahora muestra hasta 50 colegios por página. |
| 7 | Pulsa sobre la fila de un colegio. | Te lleva a la pantalla de detalle de ese colegio (ver F4). |

### Qué está pasando por dentro (en simple)
La plataforma guarda todos los colegios en una sola tabla con sus datos clave (nombre, plan, estado, fecha de creación, etc.). Los filtros se aplican en el servidor para que la búsqueda sea rápida incluso con miles de colegios. Si buscas caracteres especiales como `'` o `%`, la plataforma los maneja correctamente para que no rompan la consulta.

### Cosas que pueden salir mal
- Escribes un plan que no existe en el sistema → ves "Plan inválido".

---

## F4. Ver el detalle de un colegio

**Qué vamos a probar:** que desde la ficha de un colegio puedas ver toda su información clave sin tener que ir a otros módulos.

### Antes de empezar
- Tener al menos un colegio creado y activo.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la ficha de un colegio escribiendo su identificador en la URL, o haciendo clic desde la lista (F3). | Ves una cabecera con el nombre del colegio, su plan actual y su estado (Activo/Suspendido). |
| 2 | Verás cinco pestañas: General, Usuarios, Suscripción, Métricas, Auditoría. | Las cinco pestañas aparecen y la primera ("General") se muestra por defecto. |
| 3 | Pulsa la pestaña "Usuarios". | Aparece la lista de todas las personas de ese colegio. |
| 4 | Pulsa la pestaña "Suscripción". | Ves el plan contratado, la fecha del próximo cobro y el método de pago. |

### Qué está pasando por dentro (en simple)
La ficha de un colegio junta información que normalmente está repartida en varios módulos. Esto te evita tener que saltar de pantalla en pantalla cuando estás apoyando a un cliente.

### Cosas que pueden salir mal
- El identificador no existe → ves "Colegio no encontrado" y un botón para volver a la lista.

---

## F5. Suspender un colegio

**Qué vamos a probar:** que cuando suspendes un colegio, sus usuarios pierdan acceso de inmediato y nadie pueda seguir trabajando hasta que se reactive.

### Antes de empezar
- Tener un colegio en estado "Activo" al que le quieras suspender.
- Avisar al colegio antes (es una acción disruptiva).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Desde la ficha del colegio (F4), pulsa "Suspender". | Se abre una ventana pidiéndote el motivo. |
| 2 | Escribe el motivo (por ejemplo "Mora de más de 60 días"). | El motivo queda registrado para auditoría. |
| 3 | Confirma. | El estado del colegio cambia a "Suspendido" y el botón "Suspender" desaparece (ya no se puede suspender dos veces). |
| 4 | Intenta iniciar sesión con la cuenta de un usuario de ese colegio. | El sistema rechaza el inicio de sesión. |
| 5 | Verifica que cualquier usuario ya conectado dentro de ese colegio pierde acceso (sus peticiones ahora fallan). | Esto se valida con una herramienta técnica (no es un clic del usuario). |

### Qué está pasando por dentro (en simple)
Cuando suspendes un colegio, la plataforma marca el colegio como "no autorizado" en su base de datos. Los nuevos intentos de inicio de sesión se rechazan de inmediato. **Pero la plataforma también cierra cualquier sesión que ya estuviera abierta** para que nadie pueda seguir trabajando mientras está suspendido. Esto se hace por seguridad: si no, alguien podría seguir entrando hasta que su sesión caducara naturalmente (hasta varias horas).

### Cosas que pueden salir mal
- Intentas suspender un colegio ya suspendido → ves "Este colegio ya está suspendido".
- Dejas el motivo vacío → el formulario no te deja continuar (es obligatorio para auditoría).

---

## F6. Reactivar un colegio

**Qué vamos a probar:** que un colegio suspendido pueda volver a operar normalmente sin perder sus datos.

### Antes de empezar
- Tener un colegio actualmente suspendido.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Desde la ficha del colegio suspendido, pulsa "Reactivar". | Se abre una ventana de confirmación. |
| 2 | Confirma. | El estado del colegio cambia a "Activo". |
| 3 | Pide a un usuario del colegio que intente iniciar sesión. | Ahora puede hacerlo normalmente. |

### Qué está pasaando por dentro (en simple)
Reactivar es la operación inversa a suspender: vuelve a permitir nuevos accesos. **Los datos del colegio (estudiantes, notas, calificaciones) nunca se borran al suspender**, solo se bloquea el acceso. Por eso, al reactivar, todo vuelve como estaba.

### Cosas que pueden salir mal
- Intentas reactivar un colegio que ya está activo → ves "Este colegio ya está activo, no hay nada que reactivar".

---

## F7. Suplantar a un usuario (impersonación)

**Qué vamos a probar:** que el equipo de soporte pueda entrar a la cuenta de un usuario para resolver problemas sin pedirle su contraseña.

### Antes de empezar
- Sesión iniciada como super-admin.
- Tener un usuario objetivo que esté **activo** y **no sea otro super-admin**.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Desde la ficha de un colegio (F4), abre la pestaña "Usuarios". | Ves la lista de usuarios del colegio. |
| 2 | Pulsa "Suplantar" en la fila del usuario. | Se abre una ventana pidiéndote el motivo (para auditoría). |
| 3 | Escribe el motivo (por ejemplo "Soporte: usuario reporta bloqueo al entrar"). | El motivo queda registrado. |
| 4 | Confirma. | La plataforma te lleva a la cuenta del usuario. Verás un aviso arriba que dice "Estás suplantando a [nombre]". |
| 5 | Intenta usar la plataforma como ese usuario. | Todo funciona como si estuvieras en su cuenta. |
| 6 | Intenta suplantar a otro super-admin. | La plataforma te rechaza y te dice por qué. |
| 7 | Intenta suplantar a un usuario desactivado. | La plataforma te rechaza. |
| 8 | Cuando termines, pulsa "Salir de suplantación". | Vuelves a tu cuenta de super-admin. |

### Qué está pasando por dentro (en simple)
La suplantación genera un **token temporal** que vale como el del usuario objetivo. Todos los clics que hagas quedan registrados en el log de auditoría con tu identidad real, **no la del usuario suplantado** — así siempre queda claro quién hizo qué. Por seguridad, **nunca puedes suplantar a otro super-admin** (si pudieras, dos personas podrían tener el mismo poder y no habría control). Tampoco puedes suplantar a usuarios desactivados.

### Cosas que pueden salir mal
- Intentas suplantar a otro super-admin → ves "No puedes suplantar a otro super-admin".
- Intentas suplantar a un usuario inactivo → ves "No puedes suplantar a un usuario desactivado".

---

## F8. Ver el registro de auditoría

**Qué vamos a probar:** que cualquier cosa importante que pase en la plataforma quede registrada con fecha, autor y acción.

### Antes de empezar
- Sesión iniciada como super-admin.
- Haber generado al menos un evento (login, creación de usuario, etc.).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre "Auditoría" en el menú. | Ves una tabla con todos los eventos recientes: fecha, colegio, persona, acción, recurso. |
| 2 | Filtra por un colegio concreto. | Solo aparecen los eventos de ese colegio. |
| 3 | Filtra por acción "Login fallido". | Solo aparecen los intentos de inicio de sesión que fallaron. |
| 4 | Selecciona un rango de fechas (por ejemplo, los últimos 7 días). | Solo aparecen los eventos de ese período. |
| 5 | Combina los filtros. | La tabla muestra solo lo que cumple todas las condiciones. |
| 6 | Pulsa "Exportar CSV". | Se descarga un archivo CSV con todos los resultados filtrados. |

### Qué está pasando por dentro (en simple)
La plataforma guarda un registro inmutable de todo lo importante: cada login (exitoso o fallido), cada creación de usuario, cada cambio de plan, cada suplantación. Este registro **no se puede borrar** — es la "caja negra" de la plataforma. Te sirve para investigar incidentes o responder "¿quién hizo X?".

### Cosas que pueden salir mal
- Sin filtros aplicados y muchos eventos → la tabla se llena pero sigue funcionando (con paginación).
- Rango de fechas futuro → la tabla sale vacía (no hay eventos del futuro).

---

## Apéndice A — Cómo reportar lo que encuentras

Si un paso no funciona como dice esta guía, **no lo corrijas tú mismo**. Tu trabajo es detectar el problema y reportarlo.

**Anota:**
- Qué paso estabas haciendo (número y nombre).
- Qué hiciste exactamente.
- Qué esperabas que pasara.
- Qué pasó realmente.
- Captura de pantalla si puedes.

**Luego:** abre `/help/role/super-admin/<funcionalidad>` en la plataforma (el wizard del Centro de Pruebas) y usa el botón "Reportar bug".

## Apéndice B — Glosario rápido

| Palabra en la guía | Qué significa |
|---|---|
| MRR (Monthly Recurring Revenue) | Ingreso mensual recurrente: lo que pagan los colegios cada mes |
| Plan | El paquete que contrata un colegio (Básico, Estándar, Empresarial) |
| Suspender | Bloquear el acceso a un colegio por impago o incumplimiento |
| Reactivar | Volver a permitir el acceso después de suspender |
| Suplantar (impersonar) | Entrar a la plataforma como otro usuario, con permiso, para dar soporte |
| Auditoría | El registro inmutable de todo lo que pasa en la plataforma |
| Bypass de MFA | Atajo para saltar la verificación en dos pasos (solo desarrollo) |