# Guía de pruebas — Administrador del colegio (TENANT_ADMIN)

**Para quién es esta guía:** personas que van a probar la plataforma como si fueran el/la administrador(a) de un colegio real.
**Qué necesitas antes de empezar:**
- Tener un colegio de prueba creado y activo (slug `demo`).
- Una cuenta de administrador ya creada dentro de ese colegio.
- Conocer el email y contraseña de esa cuenta (los del colegio de prueba).
- Haber iniciado sesión con el selector de colegio puesto en `demo`.

**Cómo usar esta guía:**
1. Lee el **paso a paso** y hazlo en tu pantalla.
2. Mira la columna **"Lo que debería pasar después"** para saber si funcionó.
3. Marca cada paso como ✅ cuando lo completes.
4. Si algo no pasa como dice la guía, **anota qué pasó realmente** — eso es un hallazgo que reportarás al equipo.

---

## Índice de funcionalidades

| # | Funcionalidad | Cosas que vas a probar |
|---|---|---|
| F1 | Iniciar sesión | El colegio correcto, la cuenta correcta, sin errores raros |
| F2 | Invitar a un docente | Mandar una invitación, abrir el link, completar el alta |
| F3 | Inscribir a un estudiante | Crear el registro completo, ver que aparece en la lista |
| F4 | Vincular un padre o madre | Mandar invitación, elegir a qué hijo se vincula |
| F5 | Dar permisos especiales a un compañero | Asignar y quitar permisos, ver el efecto |
| F6 | Configurar el año académico | Crear, activar, editar, eliminar años |
| F7 | Configurar los niveles y grados | Crear niveles (Primaria, Secundaria), agregar grados |
| F8 | Ver el panel del colegio | Las cifras que muestra, los filtros |

---

## F1. Iniciar sesión

**Qué vamos a probar:** que solo puedas entrar al colegio correcto con la cuenta correcta.

### Antes de empezar
- Debes tener una cuenta `admin@demo.pe` activa en el colegio `demo`.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la pantalla de inicio de sesión. | Ves un formulario con tres casillas: email, contraseña e institución. |
| 2 | Escribe tu email (por ejemplo `admin@demo.pe`). | La casilla acepta el texto. |
| 3 | Escribe tu contraseña. | Los caracteres se ocultan con puntitos. |
| 4 | Escribe el nombre corto del colegio (`demo`). | La casilla acepta el texto. |
| 5 | Pulsa el botón "Ingresar". | En pocos segundos te lleva al panel principal con tu nombre arriba. |

### Qué está pasando por dentro (en simple)
La plataforma revisa tres cosas a la vez: que el email exista, que la contraseña sea la correcta y que el colegio donde intentas entrar sea válido. Si las tres coinciden, te abre la sesión; si alguna falla, te dice que las credenciales no son válidas (sin decirte cuál falló, por seguridad).

### Cosas que pueden salir mal
- Escribes mal el email o la contraseña → ves un mensaje rojo que dice "Credenciales inválidas".
- Escribes un colegio que no existe → ves un mensaje que dice "Institución no encontrada".
- La cuenta está desactivada → ves un mensaje que dice que no tienes permiso.

---

## F2. Invitar a un docente

**Qué vamos a probar:** que un docente nuevo pueda recibir la invitación, aceptarla y empezar a usar la plataforma.

### Antes de empezar
- Debes tener permiso para invitar docentes (lo tiene cualquier administrador del colegio).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Usuarios". | Ves una tabla con todos los usuarios del colegio. |
| 2 | Pulsa el botón "Invitar docente". | Se abre una ventana para escribir el email y el nombre. |
| 3 | Llena con un email que no exista todavía, un nombre y un apellido. Marca el rol "Docente". | El formulario se ve completo. |
| 4 | Pulsa "Enviar invitación". | Ves un aviso verde que dice "Invitación enviada" y el nuevo docente aparece en la tabla con estado "Pendiente". |
| 5 | Abre en otra ventana el correo que mandamos. | Hay un email con un botón o link de "Aceptar invitación". |
| 6 | Pulsa ese link. | Te lleva a una pantalla que dice "Hola, [nombre]" y pide crear una contraseña. |
| 7 | Escribe una contraseña (mínimo 8 caracteres, una mayúscula y un número). | Se acepta. |
| 8 | Pulsa "Crear cuenta". | La cuenta queda activa. El nuevo docente ya puede iniciar sesión. |
| 9 | Cierra la sesión del admin y entra con el nuevo email y la contraseña temporal. | Ves el panel del docente con sus cursos asignados. |

### Qué está pasando por dentro (en simple)
Cuando mandas la invitación, la plataforma genera un link único y secreto que solo funciona una vez. Por seguridad, ese link caduca después de un tiempo. Cuando el docente lo abre, la plataforma le deja crear su contraseña y activa su cuenta; a partir de ahí es un usuario más del colegio. **Si mandas la misma invitación dos veces, la segunda falla porque la primera sigue vigente** — eso es para evitar duplicados.

### Cosas que pueden salir mal
- El email ya está registrado → ves "Ya existe una invitación pendiente para ese email".
- Escribes un email mal formado (sin @) → el formulario no te deja enviar.
- El link de invitación ya expiró → la plataforma pide que se mande una nueva invitación.

---

## F3. Inscribir a un estudiante

**Qué vamos a probar:** que un estudiante nuevo quede registrado con su curso y sección correctos.

### Antes de empezar
- Necesitas tener creado al menos un año académico (ver F6).
- Necesitas tener al menos un nivel, un curso, una sección y un período (ver F7).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Estudiantes". | Ves la lista de todos los estudiantes del colegio con su foto, nombre y grado. |
| 2 | Pulsa "Nuevo estudiante". | Se abre un formulario para llenar sus datos. |
| 3 | Llena nombre, apellido, tipo y número de documento, fecha de nacimiento. | El formulario se ve completo. |
| 4 | Selecciona el curso (ejemplo: "5to de primaria") y la sección ("A"). | Ves el nombre del curso y la sección elegidos. |
| 5 | Selecciona el período académico actual. | Aparece el año y el período elegido. |
| 6 | Pulsa "Guardar". | Ves un aviso verde. El estudiante aparece en la lista con su estado "Activo". |
| 7 | Pulsa sobre el estudiante nuevo en la lista. | Se abre su ficha completa con sus datos, calificaciones y un código QR personal. |

### Qué está pasando por dentro (en simple)
La plataforma revisa que ese documento no esté repetido en el colegio (no puede haber dos estudiantes con el mismo DNI dentro de la misma institución). También verifica que la sección tenga capacidad disponible — si la sección ya está llena, no te deja inscribir más. Cuando guardas, al estudiante se le genera automáticamente un código QR único que va a usar para registrar su asistencia.

### Cosas que pueden salir mal
- Ya hay un estudiante con ese mismo documento en este colegio → ves "Ya existe un estudiante con ese documento".
- La sección ya no tiene cupos → ves "La sección está llena, elige otra".

---

## F4. Vincular un padre o madre

**Qué vamos a probar:** que un padre/madre pueda ver la información de su hijo/a desde su propia cuenta.

### Antes de empezar
- Necesitas tener al menos un estudiante ya inscrito (ver F3).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Usuarios" y filtra por "Padre/Madre". | Ves solo los padres y madres registrados. |
| 2 | Pulsa "Invitar padre/madre". | Se abre el formulario de invitación. |
| 3 | Llena email, nombre y apellido. Marca el rol "Padre/Madre". | El formulario está completo. |
| 4 | Marca qué hijos quieres vincular a esta cuenta (puedes elegir varios). | Los hijos elegidos aparecen con un check. |
| 5 | Pulsa "Enviar invitación". | Ves un aviso verde. El padre/madre recibe el email. |
| 6 | Cuando el padre/madre acepta la invitación e inicia sesión, su panel debe mostrar solo los hijos vinculados. | Ve a su panel y comprueba que los hijos que marcaste aparecen listados. |

### Qué está pasando por dentro (en simple)
La plataforma crea una relación entre el usuario padre/madre y los estudiantes que marcaste. Esa relación es privada: **el padre/madre solo puede ver a los hijos que tú le vinculares, no a otros estudiantes del colegio**, aunque estén en la misma sección.

### Cosas que pueden salir mal
- Intentas vincular un estudiante que pertenece a otro colegio → ves "No tienes permiso para vincular ese estudiante".

---

## F5. Dar permisos especiales a un compañero

**Qué vamos a probar:** que los roles con permisos limitados (por ejemplo, administrativos con permiso solo de pagos) vean las pantallas correctas según lo que les asignes.

### Antes de empezar
- Necesitas al menos un usuario con rol distinto al tuyo (por ejemplo, un "STAFF" o un "Docente").

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Usuarios" y pulsa sobre un usuario. | Se abre el panel lateral con sus datos. |
| 2 | Pulsa la pestaña "Roles". | Ves la lista de permisos especiales que puede tener. |
| 3 | Marca la casilla "Permiso de pagos" (u otro disponible). | Ves el cambio guardado y un aviso verde. |
| 4 | Cierra sesión y entra con la cuenta de ese usuario. | Las pantallas que ahora puede ver son las correctas según su nuevo permiso. |
| 5 | Regresa y quita el permiso. | El aviso de cambio aparece. El usuario ya no ve esas pantallas. |

### Qué está pasando por dentro (en simple)
Los permisos especiales funcionan como "llaves adicionales". Un usuario normal solo tiene las llaves de su rol; con un permiso extra, accede a pantallas específicas (por ejemplo, pagos, calificaciones, reportes). **Si le quitas la última llave, queda sin nada** — la plataforma te avisa para que no dejes al usuario "a oscuras".

### Cosas que pueden salir mal
- Quitas todos los permisos y el usuario se queda sin rol → la plataforma no te deja, te pide que mantenga al menos uno.

---

## F6. Configurar el año académico

**Qué vamos a probar:** que puedas crear, abrir, editar y cerrar años académicos (la base de todo lo demás).

### Antes de empezar
- Ninguno especial, pero si ya hay un año activo y quieres crear otro, primero tendrás que cerrar el actual.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Académico → Años académicos". | Ves una tabla con los años que ya existen. |
| 2 | Pulsa "Nuevo año". | Se abre un formulario. |
| 3 | Escribe el nombre (por ejemplo "2026"), la fecha de inicio y la fecha de fin. | El formulario se ve completo. |
| 4 | Pulsa "Guardar". | El año aparece en la tabla con estado "Inactivo". |
| 5 | Pulsa el botón "Activar" en el año nuevo. | El estado cambia a "Activo". Si había otro activo, ese pasa a "Inactivo". |
| 6 | Pulsa "Editar" en el año y cambia las fechas. | Los cambios se guardan y se reflejan en la tabla. |
| 7 | Pulsa "Eliminar" en un año que no se está usando. | El año desaparece de la tabla. |

### Qué está pasando por dentro (en simple)
Solo puede haber **un año académico activo a la vez** en el colegio — la plataforma no te deja activar dos a la vez. Esto es porque todas las notas, horarios y reportes se asocian al año activo. Si eliminas un año que tiene notas o estudiantes asociados, la plataforma te avisa y no te deja borrarlo para no perder información.

### Cosas que pueden salir mal
- Intentas activar dos años a la vez → ves "Ya hay un año activo, ciérralo antes de abrir otro".
- Intentas eliminar un año que tiene dependencias → ves "No se puede eliminar porque tiene niveles/secciones asociados".

---

## F7. Configurar los niveles y grados

**Qué vamos a probar:** que puedas crear los niveles del colegio (Primaria, Secundaria) y los grados dentro de cada uno.

### Antes de empezar
- Necesitas un año académico activo (ver F6).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Académico → Niveles y grados". | Ves los niveles que ya existen. |
| 2 | Pulsa "Nuevo nivel". | Se abre un formulario. |
| 3 | Llena con el nombre del nivel (por ejemplo "Primaria") y una descripción. | El formulario está completo. |
| 4 | Pulsa "Guardar". | El nivel aparece en la lista. |
| 5 | Pulsa "Agregar grado" dentro del nivel. | Se abre un campo para escribir el nombre del grado. |
| 6 | Escribe "1°", "2°", "3°" y guarda cada uno. | Aparecen tres filas de grados dentro del nivel. |
| 7 | Intenta borrar un grado que ya tiene una sección creada. | La plataforma no te deja y te avisa por qué. |

### Qué está pasando por dentro (en simple)
Los niveles son como "pisos" del colegio (Primaria, Secundaria) y los grados son como "salones" dentro de cada piso. Las secciones y los cursos cuelgan de los grados, así que no puedes borrar un grado si ya hay algo construido encima. Esto es para no romper la estructura cuando ya hay estudiantes asignados.

### Cosas que pueden salir mal
- Dejas el nombre del grado vacío → el formulario no te deja guardar.
- Intentas borrar un grado con secciones → ves "No se puede borrar porque tiene secciones".

---

## F8. Ver el panel del colegio

**Qué vamos a probar:** que las cifras del panel (estudiantes, cursos, asistencia, pagos) coincidan con la realidad del colegio.

### Antes de empezar
- Sesión iniciada como administrador del colegio.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al panel principal. | Ves cuatro tarjetas con números grandes (estudiantes activos, cursos, asistencia del mes, pagos del mes). |
| 2 | Compara el número de "Estudiantes activos" con la lista del módulo Estudiantes. | Los dos números deben coincidir. |
| 3 | Pulsa "Ver reporte" en alguna tarjeta. | Te lleva a un reporte filtrado por esa métrica. |
| 4 | Vuelve al panel y aplica el filtro "Año académico: 2026". | Las cifras se actualizan con los datos de ese año. |

### Qué está pasando por dentro (en simple)
El panel arma los datos en tiempo real consultando las mismas tablas que usas al buscar estudiantes, cursos y pagos. Si los números no cuadran, es una buena pista de que algo no se actualizó correctamente — anota qué cifra está mal y en qué módulo se ve el dato correcto.

### Cosas que pueden salir mal
- No hay año académico activo → las tarjetas muestran `0` o `Sin datos`, en vez de un error.

---

## Apéndice A — Cómo reportar lo que encuentras

Si un paso no funciona como dice esta guía, **no lo corrijas tú mismo**. Tu trabajo es detectar el problema y reportarlo.

**Anota:**
- Qué paso estabas haciendo (número y nombre).
- Qué hiciste exactamente.
- Qué esperabas que pasara.
- Qué pasó realmente (qué mensaje, qué pantalla viste, qué se quedó cargando).
- Una captura de pantalla si puedes.

**Luego:** abre `/help/role/tenant-admin/<funcionalidad>` en la plataforma (el wizard del Centro de Pruebas), ejecuta el paso que falló, y usa el botón "Reportar bug". El equipo técnico recibirá tu reporte con la misma información.

## Apéndice B — Glosario rápido

| Palabra en la guía | Qué significa |
|---|---|
| Colegio / institución / tenant | La organización dueña de los datos (un colegio, una academia, etc.) |
| Curso | Una materia (Matemáticas, Lenguaje) impartida en un grado |
| Sección | Un grupo específico dentro de un grado (5to A, 5to B) |
| Período | Un tramo del año (trimestre, bimestre) en el que se evalúa |
| Nivel | La agrupación mayor (Primaria, Secundaria) |
| Año académico | El año escolar completo (2026) — solo hay uno activo a la vez |
| Capacidad | Cupo máximo de estudiantes en una sección |
| Permiso especial | Llave adicional que da acceso a pantallas concretas (pagos, reportes…) |