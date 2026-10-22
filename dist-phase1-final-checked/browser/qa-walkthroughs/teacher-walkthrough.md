# Guía de pruebas — Docente (TEACHER)

**Para quién es esta guía:** personas que van a probar la plataforma como si fueran un profesor o profesora de un colegio.
**Qué necesitas antes de empezar:**
- Un colegio de prueba con al menos un año académico activo.
- Una cuenta de docente activa (`teacher@demo.pe`) con al menos una asignación (curso + sección + período).
- Ese docente debe tener al menos un curso con estudiantes matriculados.

---

## Índice de funcionalidades

| # | Funcionalidad | Cosas que vas a probar |
|---|---|---|
| F1 | Iniciar sesión | Entrar al colegio correcto con tu cuenta |
| F2 | Ver tu panel principal | Tus clases de hoy, tareas, evaluaciones activas |
| F3 | Crear una sesión de clase | Planificar el contenido de una clase |
| F4 | Pasar lista con QR | Generar el código y registrar a tus estudiantes |
| F5 | Crear una evaluación con rúbrica | Diseñar la evaluación con sus criterios de calificación |
| F6 | Publicar material para el curso | Subir archivos o enlaces para tus estudiantes |
| F7 | Usar el asistente de IA | Pedir ideas para tus clases |

---

## F1. Iniciar sesión

**Qué vamos a probar:** que puedas entrar como docente de forma rápida.

### Antes de empezar
- Tener tu cuenta de docente activa (`teacher@demo.pe`).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la pantalla de inicio de sesión. | Ves un formulario con email, contraseña e institución. |
| 2 | Escribe tu email, tu contraseña y el nombre del colegio (`demo`). | Las tres casillas tienen texto. |
| 3 | Pulsa "Ingresar". | Te lleva al panel del docente. |

### Cosas que pueden salir mal
- Email o contraseña incorrectos → ves "Credenciales inválidas".
- Escribes un colegio que no existe → ves "Institución no encontrada".

---

## F2. Ver tu panel principal

**Qué vamos a probar:** que el panel te muestre lo que te importa hoy, sin que tengas que buscar.

### Antes de empezar
- Sesión de docente iniciada.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Al iniciar sesión, te aparece automáticamente tu panel. | Ves cuatro tarjetas con números grandes (clases de hoy, tareas pendientes, evaluaciones activas, anuncios nuevos). |
| 2 | Mira la sección "Clases de hoy". | Ves la lista de sesiones que tienes programadas para hoy. |
| 3 | Mira "Tareas pendientes". | Ves las tareas que aún no has calificado. |
| 4 | Confirma que el saludo dice "Hola, [tu nombre]". | El nombre aparece arriba del panel. |

### Qué está pasando por dentro (en simple)
El panel arma los datos según tus cursos y secciones asignados. **Si no tienes ninguna asignación, el panel estará casi vacío** — no es un error, simplemente significa que todavía no te han vinculado a ningún curso.

### Cosas que pueden salir mal
- No tienes asignaciones → el panel dice "Sin clases asignadas".

---

## F3. Crear una sesión de clase

**Qué vamos a probar:** que puedas planificar una clase definiendo qué vas a enseñar.

### Antes de empezar
- Tener al menos una asignación (curso + sección + período).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Sesiones de clase". | Ves la lista de sesiones que has creado antes. |
| 2 | Pulsa "Nueva sesión". | Se abre un formulario. |
| 3 | Selecciona la asignación (el curso, sección y período donde vas a dar la clase). | Aparece seleccionado en el formulario. |
| 4 | Escribe el tema de la clase (por ejemplo "Sumas con llevadas"), la fecha y la duración. | El formulario está completo. |
| 5 | Pulsa "Crear". | Ves un aviso verde. La sesión aparece en la lista. |
| 6 | Pulsa sobre la sesión recién creada. | Se abre el detalle. Verás un botón "Iniciar asistencia" listo para usar. |

### Qué está pasando por dentro (en simple)
Cada sesión de clase es como una "clase planificada" en tu agenda. Te permite después tomar asistencia (F4) sobre esa clase específica. La plataforma guarda la sesión con todos sus datos: tema, fecha, curso, sección. **No hay límite en cuántas sesiones puedes crear**, pero solo puedes planificar una para un curso/sección/fecha a la vez (si ya existe otra para esa misma combinación, la plataforma te avisa).

### Cosas que pueden salir mal
- Intentas crear una sesión para una fecha muy lejana (más de 30 días) → la plataforma no te deja.
- No seleccionas curso o sección → el formulario no te deja guardar.

---

## F4. Pasar lista con QR

**Qué vamos a probar:** que tus estudiantes puedan registrar su asistencia escaneando tu código QR, y que tú puedas cerrarla al final.

### Antes de empezar
- Tener una sesión de clase creada (F3) para el día de hoy.
- Tener estudiantes matriculados en esa sección.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Desde el detalle de tu sesión del día, pulsa "Iniciar asistencia". | Se abre una ventana de confirmación. |
| 2 | Confirma "Generar QR". | Tu sesión cambia a estado "Abierta" y aparece una imagen QR en tu pantalla con un contador de tiempo (60 segundos). |
| 3 | Tus estudiantes escanean ese QR con sus celulares (o tú lo escaneas desde otra cuenta de prueba). | En tu pantalla, la lista de asistencia se va llenando con cada estudiante que marca "Presente". |
| 4 | Cuando termina la clase, pulsa "Cerrar asistencia". | La sesión cambia a estado "Cerrada". Ya nadie puede seguir marcando. |
| 5 | Intenta registrar a un estudiante cuando ya está cerrada. | La plataforma te rechaza (te dice "asistencia cerrada"). |

### Qué está pasando por dentro (en simple)
El QR es como un **código que cambia cada 60 segundos** — eso evita que un estudiante lo capture con la cámara de un amigo y lo use fuera del aula. Cada vez que un estudiante escanea, la plataforma marca la asistencia con la hora exacta. **Cuando cierras la asistencia, nadie más puede escanear**, aunque tengan una foto del QR anterior.

Si un estudiante intenta escanear dos veces (por accidente), la plataforma le dice "Ya estás registrado" en vez de duplicarlo.

### Cosas que pueden salir mal
- Intentas iniciar la asistencia dos veces para la misma sesión → la plataforma te dice "La asistencia ya está abierta".
- Un estudiante intenta escanear un QR que tiene más de 60 segundos → la plataforma le dice "El código ya expiró, espera al siguiente".
- Un estudiante de otro colegio intenta usar ese QR → la plataforma lo rechaza.

---

## F5. Crear una evaluación con rúbrica

**Qué vamos a probar:** que puedas crear evaluaciones (exámenes, tareas calificables) con criterios claros para que la calificación sea justa y consistente.

### Antes de empezar
- Tener al menos una rúbrica creada (o poder crear una nueva desde cero).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Evaluaciones". | Ves la lista de evaluaciones que has creado. |
| 2 | Pulsa "Nueva evaluación". | Se abre un asistente. |
| 3 | Escribe el título (por ejemplo "Examen de matemáticas - unidad 1"), la descripción, y selecciona el curso y la sección. | El primer paso del asistente está completo. |
| 4 | Selecciona una rúbrica existente (o crea una nueva desde el formulario). | La rúbrica queda vinculada a la evaluación. |
| 5 | Define los criterios de la rúbrica: por ejemplo "Resolución de problemas" (peso 40%, máximo 10 puntos), "Procedimiento" (peso 30%), "Presentación" (peso 30%). | Los criterios suman 100% y el puntaje máximo está claro. |
| 6 | Pulsa "Publicar". | Ves un aviso verde. La evaluación ya aparece en el panel de tus estudiantes. |

### Qué está pasando por dentro (en simple)
Una rúbrica es la "guía de calificación" que defines antes de empezar a evaluar. Cuando tus estudiantes entreguen, tú vas marcando qué puntaje se lleva en cada criterio — la plataforma suma automáticamente la nota final. **El peso total de los criterios debe sumar 100%** — si no, la plataforma no te deja guardar. Esto es para que la calificación siempre tenga un significado claro.

### Cosas que pueden salir mal
- Los pesos de tus criterios no suman 100% → la plataforma no te deja guardar.
- Dejas la evaluación sin rúbrica → la plataforma te avisa que es necesario.

---

## F6. Publicar material para el curso

**Qué vamos a probar:** que puedas compartir con tus estudiantes materiales (PDFs, enlaces, documentos) de forma ordenada.

### Antes de empezar
- Tener un curso activo donde publicar.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Cursos" y selecciona uno. | Ves la página del curso con sus materiales existentes. |
| 2 | Pulsa "Subir material". | Se abre un formulario. |
| 3 | Arrastra o selecciona un archivo PDF (que pese menos de 10 MB). | Aparece la vista previa del archivo. |
| 4 | Escribe el título del material y una descripción breve. | El formulario está completo. |
| 5 | Pulsa "Publicar". | Ves un aviso verde. El material aparece en la lista y tus estudiantes ya pueden acceder a él. |

### Qué está pasando por dentro (en simple)
La plataforma guarda el archivo de forma segura y le da una URL privada que solo pueden abrir quienes tengan acceso al curso. **Los archivos que pesen más de 10 MB no se pueden subir** (es un límite para no saturar el espacio del colegio) y los archivos que no sean del tipo permitido (por ejemplo, ejecutables) tampoco.

### Cosas que pueden salir mal
- El archivo pesa más de 10 MB → ves "El archivo es demasiado grande".
- Es un tipo de archivo no permitido → ves "Tipo de archivo no soportado".

---

## F7. Usar el asistente de IA

**Qué vamos a probar:** que puedas pedirle ideas a la IA para preparar tus clases (actividades, ejemplos, ejercicios).

### Antes de empezar
- Tener activado el permiso para usar el asistente (lo activa el administrador del colegio).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | En cualquier pantalla de un curso, busca el icono de chispas (asistente IA). | Se abre un panel lateral. |
| 2 | Escribe tu pedido, por ejemplo: "Sugiere 3 actividades sobre fracciones para 5° grado". | Ves el texto en la casilla. |
| 3 | Pulsa "Enviar". | Después de unos segundos, aparecen 3 sugerencias. |
| 4 | Pulsa "Aceptar" en la que más te guste. | La sugerencia se copia al portapapeles o se agrega a un borrador. |
| 5 | Mira el contador de uso de IA que muestra cuántas peticiones te quedan este mes. | El contador muestra el número restante. |

### Qué está pasando por dentro (en simple)
La plataforma envía tu pedido a un modelo de inteligencia artificial con instrucciones de responder en español, dirigido a docentes, y enfocado en el grado que indicaste. La IA **no reemplaza tu criterio profesional**: es una herramienta para inspirarte, no para decirte qué enseñar. Cada sugerencia debes revisarla antes de usarla con tus estudiantes.

**La plataforma tiene un límite de uso** para que nadie abuse del servicio. Cuando llegues al límite del mes, no podrás hacer más pedidos hasta el mes siguiente.

### Cosas que pueden salir mal
- Te quedaste sin cuota del mes → ves "Has llegado al límite de uso de IA este mes".
- Escribes un prompt vacío → la plataforma no envía nada.
- Escribes más de 2000 caracteres → la plataforma no acepta el prompt.

---

## Apéndice A — Cómo reportar lo que encuentras

**Anota:**
- Qué paso estabas haciendo (número y nombre).
- Qué hiciste exactamente.
- Qué esperabas que pasara.
- Qué pasó realmente.
- Captura si puedes.

**Luego:** abre `/help/role/teacher/<funcionalidad>` en la plataforma (wizard del Centro de Pruebas) y usa "Reportar bug".

## Apéndice B — Glosario rápido

| Palabra en la guía | Qué significa |
|---|---|
| Asignación | La combinación de curso + sección + período + docente que te toca enseñar |
| Sesión de clase | Una clase planificada en una fecha, dentro de una asignación |
| QR de asistencia | Código que cambia cada 60 segundos y sirve para que los estudiantes registren que están presentes |
| Rúbrica | Lista de criterios con puntaje que defines para evaluar el trabajo de tus estudiantes |
| Peso | Qué porcentaje de la nota final vale cada criterio (la suma debe ser 100%) |
| Material | Un archivo o enlace que compartes con tus estudiantes dentro de un curso |
| Asistente IA | Herramienta de inteligencia artificial que te ayuda a generar ideas para tus clases |