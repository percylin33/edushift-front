# Guía de pruebas — Personal del colegio (STAFF)

**Para quién es esta guía:** personas que van a probar la plataforma como si fueran personal administrativo o de apoyo del colegio (no docentes, pero con permisos especiales).
**Qué necesitas antes de empezar:**
- Un colegio de prueba activo.
- Una cuenta de personal activa (`staff@demo.pe`) con al menos un permiso delegado (por ejemplo, permiso de pagos).
- El administrador del colegio debe haberte asignado esos permisos (ver guía del administrador, sección F5).

> **Importante:** las capacidades de un miembro del personal **dependen de los permisos que el administrador le haya dado**. Por ejemplo, si no tienes el permiso de pagos, no verás el módulo "Conciliación de pagos". Antes de empezar, pídele al administrador que confirme qué permisos tienes asignados.

---

## Índice de funcionalidades

| # | Funcionalidad | Cosas que vas a probar |
|---|---|---|
| F1 | Iniciar sesión | Entrar al colegio con tu cuenta y ver tus permisos |
| F2 | Conciliar pagos | Marcar pagos como cobrados cuando el dinero ya entró |
| F3 | Ver reportes operativos | Consultar estadísticas del colegio sin modificar nada |

---

## F1. Iniciar sesión

**Qué vamos a probar:** que puedas entrar y ver de inmediato solo las pantallas a las que tienes permiso.

### Antes de empezar
- Tener tu cuenta de personal activa (`staff@demo.pe`).
- Al menos un permiso delegado.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la pantalla de inicio de sesión. | Ves un formulario con email, contraseña e institución. |
| 2 | Escribe tu email, tu contraseña y el nombre del colegio (`demo`). | Las tres casillas tienen texto. |
| 3 | Pulsa "Ingresar". | Te lleva a tu panel. |
| 4 | Mira el panel principal. | Verás una sección "Permisos delegados" con la lista de permisos que tienes (por ejemplo, "Permiso de pagos"). |
| 5 | Mira el menú lateral. | Solo aparecen las opciones para las que tienes permiso. Si no tienes permiso de pagos, no verás "Conciliación". |
| 6 | Intenta entrar a una URL directa de un módulo para el que no tienes permiso (por ejemplo, `/users`). | La plataforma te rechaza con un mensaje de "No tienes permiso". |

### Qué está pasando por dentro (en simple)
Los permisos son **como llaves que abren puertas específicas**. Si no tienes la llave de una puerta, no puedes entrar — ni por el menú ni escribiendo la URL directamente. Esto es por seguridad: si alguien comparte su URL contigo, no puedes ver cosas que no te corresponden. **Si necesitas un permiso nuevo, pídeselo al administrador del colegio**, no intentes encontrar una forma de saltártelo.

### Cosas que pueden salir mal
- No tienes ningún permiso asignado → el panel te avisa "Sin permisos asignados, contacta al administrador".
- Intentas entrar a un módulo sin permiso → ves un mensaje de error.

---

## F2. Conciliar pagos

**Qué vamos a probar:** que puedas marcar como cobrados los pagos que ya entraron al banco o que se pagaron en efectivo, para que la plataforma los registre correctamente.

### Antes de empezar
- Tener el permiso "Permiso de pagos" (lo activa el administrador).
- Tener al menos un pago en estado "Pendiente" en el colegio.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Pagos → Conciliación". | Ves una lista de pagos que están esperando confirmación. |
| 2 | Filtra por "Últimos 7 días". | La lista se reduce a los pagos recientes. |
| 3 | Pulsa sobre un pago. | Se abre el detalle con el monto, la fecha, el método de pago y una referencia externa. |
| 4 | Pulsa "Marcar como conciliado". | Se abre una ventana pidiéndote una nota opcional. |
| 5 | Escribe algo como "Conciliado con extracto BCP del día". | La nota queda registrada para auditoría. |
| 6 | Confirma. | Ves un aviso verde. El pago desaparece de la lista de pendientes y el administrador lo ve como "Conciliado". |
| 7 | Intenta conciliar el mismo pago dos veces. | La plataforma te rechaza y te dice "Ya está conciliado". |

### Qué está pasando por dentro (en simple)
La conciliación es el momento en que tú confirmas que **el dinero realmente entró**. Hasta que no lo concilias, el pago figura como "Pendiente" (aunque el cliente haya pagado, el dinero podría no haber llegado al banco todavía). Cuando lo concilias, la plataforma lo registra con la fecha y tu nota. Esto le sirve al administrador para tener claros los ingresos reales.

**Una vez conciliado, el pago ya no se puede desconciliar** — si te equivocaste, contacta al administrador para que corrija manualmente.

### Cosas que pueden salir mal
- El pago ya estaba conciliado → ves "Ya conciliado".
- El pago fue devuelto (reembolsado al cliente) → la plataforma no te deja conciliarlo, te dice que es un reembolso.
- Escribes una nota demasiado larga (más de 1000 caracteres) → la plataforma no la acepta.

---

## F3. Ver reportes operativos

**Qué vamos a probar:** que puedas consultar estadísticas del colegio sin poder modificarlas.

### Antes de empezar
- Tener al menos un permiso delegado que dé acceso a reportes.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Reportes operativos". | Ves la lista de reportes disponibles (pagos por día, estudiantes activos vs inactivos, etc.). |
| 2 | Selecciona "Pagos por día (último mes)". | Aparece una tabla con cada día del último mes y el monto recaudado. |
| 3 | Pulsa "Exportar CSV". | Se descarga un archivo CSV con la misma información. |
| 4 | Selecciona "Estudiantes activos vs inactivos". | Ves el conteo total. |
| 5 | Aplica un filtro por sección. | Solo aparece la información de esa sección. |

### Qué está pasando por dentro (en simple)
Los reportes son **de solo lectura**: tú miras los datos pero no puedes modificarlos. Si necesitas cambiar algo que ves (por ejemplo, recategorizar un pago), tienes que pedirle al administrador que lo haga — **no intentes modificar datos directamente desde los reportes**. Los reportes se generan en el momento con datos reales del colegio, así que si algo no cuadra con lo que ves en otro módulo, anótalo y repórtalo.

### Cosas que pueden salir mal
- Pides un rango de fechas de más de 12 meses → la plataforma no te deja.
- No hay datos para el filtro que elegiste → la tabla aparece vacía (no es un error).

---

## Apéndice A — Cómo reportar lo que encuentras

**Anota:**
- Qué paso estabas haciendo (número y nombre).
- Qué hiciste exactamente.
- Qué esperabas que pasara.
- Qué pasó realmente.
- Captura si puedes.

**Luego:** abre `/help/role/staff/<funcionalidad>` en la plataforma y usa "Reportar bug".

## Apéndice B — Glosario rápido

| Palabra en la guía | Qué significa |
|---|---|
| Permiso delegado | Una llave especial que te da acceso a una pantalla concreta (te la asigna el administrador) |
| Conciliar pago | Confirmar oficialmente que el dinero de un pago ya entró al banco o se cobró |
| Estado "Pendiente" | El pago figura como aún no confirmado (aunque el cliente haya pagado) |
| Estado "Conciliado" | El pago ya fue confirmado y registrado oficialmente |
| Reporte operativo | Una vista de solo lectura con estadísticas del colegio |
| CSV | Un archivo de tabla que puedes abrir en Excel o Google Sheets |