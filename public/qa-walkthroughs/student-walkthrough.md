# Guía de pruebas — Estudiante (STUDENT)

**Para quién es esta guía:** personas que van a probar la plataforma como si fueran un alumno o alumna de un colegio.
**Qué necesitas antes de empezar:**
- Un colegio de prueba activo.
- Una cuenta de estudiante activa (`student@demo.pe`), matriculada en al menos una sección.
- Que el docente haya generado un QR de asistencia abierto (para F3).

---

## Índice de funcionalidades

| # | Funcionalidad | Cosas que vas a probar |
|---|---|---|
| F1 | Iniciar sesión | Entrar al colegio con tu cuenta |
| F2 | Ver tu panel principal | Tus próximas clases y tus calificaciones recientes |
| F3 | Marcar asistencia | Escanear el QR de tu profesor para registrar que estás presente |
| F4 | Responder un quiz | Hacer un cuestionario en línea |
| F5 | Entregar una tarea | Subir tu archivo y enviar la tarea a tu profesor |

---

## F1. Iniciar sesión

**Qué vamos a probar:** que puedas entrar al colegio donde estudias con tu cuenta.

### Antes de empezar
- Tener tu cuenta de estudiante activa (`student@demo.pe`).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la pantalla de inicio de sesión. | Ves un formulario con email, contraseña e institución. |
| 2 | Escribe tu email, tu contraseña y el nombre del colegio (`demo`). | Las tres casillas tienen texto. |
| 3 | Pulsa "Ingresar". | Te lleva a tu panel. |

### Cosas que pueden salir mal
- Email o contraseña incorrectos → ves "Credenciales inválidas".
- Tu cuenta está desactivada → ves un mensaje indicando que no puedes entrar.

---

## F2. Ver tu panel principal

**Qué vamos a probar:** que tu panel te muestre lo que te importa: clases de hoy, evaluaciones pendientes y tus notas recientes.

### Antes de empezar
- Sesión iniciada como estudiante.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Al iniciar sesión, ves tu panel automáticamente. | Ves cuatro tarjetas con números grandes (cursos activos, evaluaciones pendientes, tareas por entregar, anuncios nuevos). |
| 2 | Mira la sección "Próximas clases". | Ves las sesiones de clase de los próximos días. |
| 3 | Mira "Calificaciones recientes". | Ves tus últimas 5 notas. |
| 4 | Pulsa "Mi QR" para ver tu código personal. | Aparece una imagen QR con tu información. |
| 5 | Pulsa "Descargar QR" para guardar el código como imagen. | Se descarga un archivo (SVG o PNG) con tu QR. |

### Qué está pasando por dentro (en simple)
Tu QR personal es único y privado. **No lo compartas** — cualquiera que lo tenga puede intentar suplantar tu identidad al registrar asistencia. La plataforma genera ese código cuando te inscribes y nunca cambia.

---

## F3. Marcar asistencia

**Qué vamos a probar:** que puedas registrar tu asistencia escaneando el QR que muestra tu profesor en clase.

### Antes de empezar
- Tu profesor debe haber iniciado la asistencia y estar mostrando el QR.
- Tener conexión a internet.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | En tu panel, busca el botón "Marcar asistencia" de la clase actual. | Se abre la vista de la cámara o un campo para pegar el código. |
| 2 | Apunta la cámara al QR que tu profesor está mostrando. | La plataforma lee el código automáticamente. |
| 3 | Espera un momento. | Ves un mensaje verde que dice "Asistencia registrada" con la hora. |
| 4 | Intenta escanear el mismo QR una segunda vez. | La plataforma te dice "Ya estás registrado" (no te duplica). |
| 5 | Si la cámara no funciona, pulsa "Pegar código manualmente" y copia el número del QR. | Funciona igual que con la cámara. |

### Qué está pasando por dentro (en simple)
El QR de asistencia **cambia cada 60 segundos** — por eso no sirve tomar una foto del QR del profesor para usarlo después fuera del aula. Cada vez que escaneas, la plataforma valida que el código sea reciente, que la asistencia esté abierta y que no hayas marcado ya. **Si la asistencia ya está cerrada** (porque el docente la cerró después de pasar lista), no puedes registrarte aunque tengas el QR.

### Cosas que pueden salir mal
- El QR tiene más de 60 segundos → ves "El código ya expiró, espera el siguiente".
- Tu profesor ya cerró la asistencia → ves "La asistencia ya está cerrada".
- Es un QR de otro colegio → la plataforma lo rechaza.

---

## F4. Responder un quiz

**Qué vamos a probar:** que puedas hacer un cuestionario en línea con tiempo limitado y ver tu resultado.

### Antes de empezar
- Tu profesor debe haber publicado un quiz disponible.
- Tener el quiz dentro del plazo.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra a "Evaluaciones" y pulsa la pestaña "Quizzes". | Ves la lista de cuestionarios disponibles. |
| 2 | Pulsa "Iniciar quiz" en uno. | Se abre el cuestionario con la primera pregunta. |
| 3 | Lee la pregunta y selecciona tu respuesta. | La opción queda marcada. |
| 4 | Pulsa "Siguiente" para ir a la siguiente pregunta. | Aparece la siguiente. |
| 5 | Mira el tiempo restante que aparece arriba. | El contador va bajando. |
| 6 | Cuando termines, pulsa "Enviar". | Ves tu calificación automáticamente (para preguntas de opción múltiple) o el mensaje "Pendiente de calificación" (para preguntas abiertas). |
| 7 | Espera a que tu profesor califique las preguntas abiertas. | El estado del quiz cambia a "Calificado" con tu nota final. |

### Qué está pasaando por dentro (en simple)
Cuando inicias un quiz, la plataforma registra un intento y empieza a contar el tiempo. **Si se acaba el tiempo sin que hayas enviado, la plataforma lo envía automáticamente** con lo que hayas respondido hasta ese momento. Las preguntas de opción múltiple se califican al instante (la plataforma sabe la respuesta correcta); las preguntas abiertas quedan "pendientes" hasta que tu profesor las revise y les ponga nota.

### Cosas que pueden salir mal
- Intentas iniciar un quiz que ya intentaste → la plataforma te dice "Ya realizaste este quiz".
- Se acabó el tiempo mientras respondías → la plataforma envía automáticamente.

---

## F5. Entregar una tarea

**Qué vamos a probar:** que puedas subir tu trabajo y entregarlo a tu profesor.

### Antes de empezar
- Tener una tarea pendiente de entrega.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Tareas". | Ves la lista de tareas con su estado (Pendiente, Entregada, Calificada). |
| 2 | Pulsa sobre una tarea que esté en estado "Pendiente". | Se abre el detalle con la descripción y la fecha límite. |
| 3 | Pulsa "Entregar". | Se abre una ventana para subir el archivo. |
| 4 | Selecciona o arrastra tu archivo (por ejemplo, un PDF de menos de 10 MB). | Aparece la vista previa del archivo. |
| 5 | Escribe un comentario corto (por ejemplo "Aquí está mi trabajo"). | El comentario queda escrito. |
| 6 | Pulsa "Confirmar entrega". | Ves un aviso verde. El estado de la tarea cambia a "Entregada". |
| 7 | Verifica que tu profesor la ve en su lista de pendientes por calificar. | (Esto lo puedes ver entrando con una cuenta de profesor.) |

### Qué está pasando por dentro (en simple)
La plataforma guarda tu archivo en un lugar seguro y le da una URL privada que solo tu profesor puede ver. **Cuando entregas, ya no puedes volver a subir otro archivo** — la entrega es definitiva. Si te equivocaste, contacta a tu profesor para que él o ella la "desentregue" y puedas volver a intentarlo.

### Cosas que pueden salir mal
- Tu archivo pesa más de 10 MB → la plataforma no lo acepta.
- La fecha límite ya pasó → algunas tareas permiten "entrega tardía" marcada; otras no, depende de la configuración del docente.

---

## Apéndice A — Cómo reportar lo que encuentras

**Anota:**
- Qué paso estabas haciendo (número y nombre).
- Qué hiciste exactamente.
- Qué esperabas que pasara.
- Qué pasó realmente.
- Captura si puedes.

**Luego:** abre `/help/role/student/<funcionalidad>` en la plataforma y usa "Reportar bug".

## Apéndice B — Glosario rápido

| Palabra en la guía | Qué significa |
|---|---|
| QR personal | Tu código único que demuestra quién eres (no lo compartas) |
| QR de asistencia | El código que muestra tu profesor en clase y cambia cada 60 segundos |
| Quiz | Un cuestionario en línea con tiempo límite |
| Pregunta abierta | Una pregunta que tu profesor tiene que calificar manualmente (no es opción múltiple) |
| Tarea | Un trabajo que te pide tu profesor para entregar |
| Entrega tardía | Subir tu tarea después de la fecha límite (no siempre permitido) |