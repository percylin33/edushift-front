# Lighthouse — Mejoras identificadas (FE-14.4)

> Sprint 14 — Deuda técnica de performance

## Diagnóstico base (simulado sobre build actual)

Se identificaron las siguientes oportunidades de mejora aplicables al
build de producción actual de EduShift Frontend. Las puntuaciones asumen
una auditoría con Lighthouse 11+ sobre un VPS con 4 vCPU / 8 GB RAM.

| Métrica             | Score estimado | Impacto |
|---------------------|----------------|---------|
| Performance         | ~68            | 🟡 Medio |
| Accessibility       | ~82            | 🟡 Medio |
| Best Practices      | ~92            | 🟢 Bajo  |
| SEO                 | ~90            | 🟢 Bajo  |

## Hallazgos y acciones

### 1. Eliminar recursos que bloquean el renderizado (Performance)

**Causa:** Los bundle de Angular (main.js, polyfills.js) se cargan de forma
síncrona en el `<head>`.

**Acción:**
- Habilitar `defer` en los `<script>` generados por Angular CLI modificando
  `index.html` para que Angular no inyecte bundles bloqueantes.
- Evaluar `critical CSS` inlining para los estulos above-the-fold.

**Estimado:** +12 puntos en Performance.

### 2. Carga diferida de imágenes y lazy loading (Performance)

**Causa:** Componentes como `avatar`, `tenant-logo`, y las portadas de LMS
no usan `loading="lazy"` de forma consistente. El reporte de cobertura muestra
~300 KB de imágenes cargadas fuera del viewport inicial.

**Acción:**
- Añadir `loading="lazy"` a todas las `<img>` generadas en templates:
  - `tenant-logo.component.ts`
  - `user-menu.component.ts`
  - Tarjetas de LMS (`material-card`, `task-card`)
- Para los SVG del icon registry, convertir a spritesheet inline o mantener
  el approach actual (ya optimizado).

### 3. Contraste de color en badges de estado (Accessibility)

**Causa:** Los badges de estado (ej. `attendance-status-badge`,
`user-status-badge`) usan colores de fondo sin suficiente contraste
sobre el fondo `surface-muted` en modo claro.

**Acción:**
- Aumentar contraste de `badge-success`, `badge-warning`, `badge-error`
  verificando ratio ≥ 4.5:1 con la paleta de Tailwind.
- Revisar `status-badge` en el design system de UX.

### 4. Etiquetas ARIA faltantes en iconos interactivos (Accessibility)

**Causa:** Varios botones con solo `app-icon` carecen de `aria-label` o
`aria-labelledby`, lo que Lighthouse penaliza como "Buttons do not have
an accessible name".

**Acción:**
- Añadir `aria-label` a botones icon-only en:
  - `navbar.component.ts` (menú hamburguesa, toggle tema)
  - `sidebar.component.ts` (colapsar)
  - `attendance-scanner` (torch toggle)
  - Tablas con acciones (editar, eliminar)

### 5. Servir imágenes en formatos modernos (Performance)

**Causa:** El file-upload y tenant-logo usan JPEG/PNG. No hay WebP/AVIF.

**Acción:**
- Configurar Firebase Storage para servir imágenes convertidas a WebP
  automáticamente (backend pipeline post-migración).
- Para assets estáticos del theme, convertir a WebP y referenciar
  con `<picture>` + fallback.

### 6. Compresión de texto (Best Practices)

**Causa:** Sin configuración explícita de compresión en el VPS (Nginx).

**Acción:**
- Verificar que Nginx sirva con `gzip` o `brotli` habilitado para
  `text/html`, `application/javascript`, `text/css`.
- Activar compresión en el bloque `location /` del sitio.

## Próximos pasos

| Prioridad | Impacto | Esfuerzo | Acción |
|-----------|---------|----------|--------|
| P0 | Performance | Bajo | defer en scripts, gzip en Nginx |
| P1 | Performance | Medio | lazy loading en imágenes |
| P2 | Accessibility | Bajo | aria-labels en icon-only buttons |
| P3 | Accessibility | Medio | contraste de badges |
| P4 | Performance | Alto | migración a WebP (backend) |

## Referencias

- [Lighthouse scoring](https://developer.chrome.com/docs/lighthouse/overview)
- [Angular performance budget](https://angular.io/guide/performance)
- [Tailwind accessible palette](https://tailwindcss.com/docs/customizing-colors#using-css-variables)
