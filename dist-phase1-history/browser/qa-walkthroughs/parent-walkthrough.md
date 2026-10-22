# Guía de pruebas — Padre/Madre (PARENT)

**Para quién es esta guía:** personas que van a probar la plataforma como si fueran un papá, mamá o tutor de un estudiante.
**Qué necesitas antes de empezar:**
- Un colegio de prueba activo.
- Una cuenta de padre/madre activa (`parent@demo.pe`) que esté vinculada a al menos un estudiante.

> **Aviso:** la plataforma todavía tiene algunas funcionalidades pensadas para padres que están en desarrollo. Donde veas "Funcionalidad pendiente", el paso es simplemente **probar que el botón o la pantalla dice claramente "no disponible todavía"** en vez de mostrar un error.

---

## Índice de funcionalidades

| # | Funcionalidad | Cosas que vas a probar |
|---|---|---|
| F1 | Iniciar sesión | Entrar al colegio con tu cuenta |
| F2 | Ver los hijos vinculados | Quiénes son y a qué información tienes acceso |
| F3 | Justificar una inasistencia | Avisar al colegio por qué tu hijo/a faltó |
| F4 | Ver las calificaciones | Revisar cómo le está yendo en cada materia |
| F5 | Leer anuncios del colegio | Enterarte de avisos generales |

---

## F1. Iniciar sesión

**Qué vamos a probar:** que puedas entrar al colegio donde estudia tu hijo/a con tu cuenta.

### Antes de empezar
- Tener tu cuenta de padre/madre activa (`parent@demo.pe`).
- El administrador del colegio debe haberte vinculado a tu hijo/a (ver guía del administrador, sección F4).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Abre la pantalla de inicio de sesión. | Ves un formulario con email, contraseña e institución. |
| 2 | Escribe tu email, tu contraseña y el nombre del colegio (`demo`). | Las tres casillas tienen texto. |
| 3 | Pulsa "Ingresar". | Te lleva al panel de padre/madre. Verás un saludo con tu nombre. |

### Cosas que pueden salir mal
- Email o contraseña incorrectos → ves "Credenciales inválidas".
- Aún no tienes hijos vinculados → el panel te dice "Sin hijos vinculados" y te sugiere contactar al colegio.

---

## F2. Ver los hijos vinculados

> ⚠️ **Funcionalidad en desarrollo.** Esta pantalla puede no existir todavía. Si al pulsar la pestaña o el botón correspondiente no pasa nada (o ves un error), anota el paso como "no encontrado" y repórtalo.

**Qué vamos a probar:** que puedas ver a qué estudiantes tienes acceso y abrir su información.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | En tu panel, busca la pestaña o sección "Mis hijos". | Ves la lista de los estudiantes que el colegio te vinculó, con su foto, nombre y grado. |
| 2 | Pulsa sobre uno de tus hijos. | Se abre una vista con el resumen académico: calificaciones, asistencia, anuncios. |

### Qué está pasando por dentro (en simple)
La plataforma sabe qué estudiantes están vinculados a tu cuenta y **solo te muestra la información de ellos, nunca la de otros estudiantes del colegio**. Esto es por privacidad — una madre solo puede ver a sus hijos, no a los hijos de otros.

---

## F3. Justificar una inasistencia

> ⚠️ **Funcionalidad en desarrollo.** Si no encuentras el botón "Justificar", anota el paso como "no encontrado" y repórtalo.

**Qué vamos a probar:** que puedas avisar al colegio por qué tu hijo/a faltó a una clase.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | En el detalle de tu hijo, abre la pestaña "Asistencia". | Ves la lista de días recientes y si tu hijo estuvo presente o ausente. |
| 2 | Busca un día en que figure como "Ausente" (sin justificar todavía). | Lo identificas en la lista. |
| 3 | Pulsa "Justificar" en esa fila. | Se abre una ventana con un menú de motivos y un espacio para notas. |
| 4 | Selecciona el motivo (por ejemplo "Enfermedad") y escribe una nota breve ("Reposo 24 horas por indicación médica"). | El formulario está completo. |
| 5 | Pulsa "Enviar justificación". | Ves un aviso verde. La ausencia cambia a estado "Justificada" y tu profesor la ve en su lista. |

### Qué está pasando por dentro (en simple)
La plataforma guarda tu justificación con fecha, motivo y notas, y se la muestra al profesor para que él o ella la considere al evaluar la asistencia del estudiante. **No puedes justificar una ausencia futura** (no tiene sentido) ni justificar dos veces la misma (la segunda vez la plataforma te avisa).

---

## F4. Ver las calificaciones

> ⚠️ **Funcionalidad en desarrollo.** Si no encuentras la pestaña "Calificaciones" en el detalle de tu hijo, anota el paso como "no encontrado" y repórtalo.

**Qué vamos a probar:** que puedas revisar las notas de tu hijo/a en cada materia y en cada evaluación.

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | En el detalle de tu hijo, abre la pestaña "Calificaciones". | Ves una tabla con cada materia y el promedio de tu hijo. |
| 2 | Pulsa sobre una materia específica. | Se abre el detalle con cada evaluación individual (examen, tarea, quiz) y la nota que obtuvo. |

### Qué está pasando por dentro (en simple)
La plataforma te muestra las mismas calificaciones que ve el profesor, **pero solo de tus hijos**. Los demás estudiantes del colegio no aparecen en tu vista, ni siquiera si están en la misma sección.

---

## F5. Leer anuncios del colegio

**Qué vamos a probar:** que puedas enterarte de los avisos generales del colegio (reuniones, eventos, recordatorios).

### Pasos

| # | Qué haces | Lo que debería pasar después |
|---|---|---|
| 1 | Entra al módulo "Anuncios". | Ves una lista de anuncios publicados por el colegio para los padres. |
| 2 | Pulsa sobre uno para abrirlo. | Ves el anuncio completo con su autor, fecha y contenido. |
| 3 | Marca como "Leído" si quieres. | El anuncio se marca como leído (algunos colegios usan esto para confirmar asistencia a reuniones, por ejemplo). |
| 4 | Verifica que NO aparecen anuncios internos del colegio que sean solo para profesores. | Los anuncios que ves son solo los marcados como visibles para padres. |

### Qué está pasando por dentro (en simple)
Los anuncios tienen un **público destinatario** (solo profesores, solo padres, todos, etc.). La plataforma filtra automáticamente y solo te muestra los que están marcados para incluir a los padres. **Por eso nunca verás avisos internos del colegio** que sean solo para el personal docente o administrativo — esto es por privacidad y para no abrumarte con información que no te corresponde.

---

## Apéndice A — Cómo reportar lo que encuentras

**Anota:**
- Qué paso estabas haciendo (número y nombre).
- Qué hiciste exactamente.
- Qué esperabas que pasara.
- Qué pasó realmente.
- Si dice "Funcionalidad pendiente", anota exactamente qué dice la pantalla cuando intentas acceder.

**Luego:** abre `/help/role/parent/<funcionalidad>` en la plataforma y usa "Reportar bug". Para las funcionalidades pendientes, el reporte es especialmente importante porque ayuda al equipo a priorizar qué construir primero.

## Apéndice B — Glosario rápido

| Palabra en la guía | Qué significa |
|---|---|
| Hijos vinculados | Los estudiantes que el colegio autorizó que veas desde tu cuenta |
| Justificar | Avisar al colegio por qué tu hijo faltó (con motivo y nota) |
| Anuncio | Aviso general del colegio visible para padres |
| Pestaña / tab | Sección dentro de una pantalla (suelen estar arriba o al costado) |