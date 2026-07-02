# EduShift — Frontend

SaaS multi-tenant para gestión escolar construido con **Angular 19 standalone**, **Tailwind CSS** y arquitectura **feature-based**.

---

## Scripts

```bash
npm start            # serve (development)
npm run start:prod   # serve con configuración production
npm run build        # build production
npm run build:dev    # build development
npm run build:prod   # build production
npm run watch        # build development con watch
npm test             # unit tests (karma + jasmine)
```

---

## Arquitectura

Arquitectura **feature-based** con separación estricta entre infraestructura (`core`),
reutilizables (`shared`), shells (`layout`) y dominios de negocio (`features`).
Cada feature es autocontenido y se carga bajo demanda (lazy loading).

```
src/
├── app/
│   ├── core/                          # Singletons, infra, no-UI
│   │   ├── constants/                 # API, ROUTES, STORAGE_KEYS, APP
│   │   ├── enums/                     # UserRole, Permission, FeatureKey, Theme, HttpStatus
│   │   ├── guards/                    # auth, guest, role, tenant, featureFlag, permission
│   │   ├── interceptors/              # api-url, auth, tenant, loading, error
│   │   ├── models/                    # BaseEntity, ApiResponse, User, Tenant
│   │   ├── providers/                 # provideCore() + APP_INITIALIZER
│   │   ├── services/                  # Auth, Tenant, Api, Storage, Logger, Loading,
│   │   │                              # Notification, Theme
│   │   └── theming/                   # TenantThemeService + color utils
│   │
│   ├── shared/                        # UI reutilizable entre features
│   │   ├── components/                # spinner, ...
│   │   ├── directives/
│   │   ├── pipes/                     # initials, ...
│   │   ├── validators/
│   │   └── utils/                     # string, date, ...
│   │
│   ├── layout/                        # Shells de aplicación
│   │   ├── main-layout/               # Sidebar + navbar (rutas privadas)
│   │   ├── auth-layout/               # Two-pane: branding + form (login/register)
│   │   ├── onboarding-layout/         # Wizard con stepper (setup multi-step)
│   │   ├── blank-layout/              # Errores y especiales
│   │   ├── components/                # sidebar, navbar, user-menu, theme-toggle, …
│   │   ├── config/                    # navigation.config.ts (sidebar declarativo)
│   │   ├── services/                  # LayoutService, NavigationService, BreadcrumbService,
│   │   │                              # OnboardingService
│   │   └── models/                    # NavigationItem, Breadcrumb, OnboardingStep
│   │
│   └── features/                      # Dominios de negocio (lazy)
│       ├── auth/
│       ├── dashboard/
│       ├── students/
│       ├── academic/
│       ├── payments/
│       ├── ai/
│       ├── reports/
│       ├── notifications/
│       └── errors/                    # 403 / 404
│
├── environments/                      # environment.ts + .development + .production
└── styles/                            # Tokens, base, components, utilities, animations
```

### Estructura interna de cada feature

Todas las features siguen exactamente la misma estructura:

```
features/<name>/
├── pages/                  # Componentes routables (UI)
├── components/             # Componentes internos del feature (no compartidos)
├── services/               # *-api.service.ts (HTTP) + servicios feature-scope
├── store/                  # <feature>.store.ts (estado vía signals)
├── models/                 # DTOs / interfaces / tipos del dominio
├── guards/                 # Guards específicos del feature (opcional)
├── interceptors/           # Interceptors feature-scope (opcional, raro)
├── <feature>.routes.ts     # Definición de rutas + permission/feature guards
└── index.ts                # Barrel público
```

> **Regla**: los componentes/services dentro de `components/` o `services/` de un
> feature **no** pueden ser importados desde otros features. Si algo necesita
> ser reutilizado entre features, se promueve a `shared/`.

---

## Layout system

Cuatro shells reutilizables, todos respetando el theming por tenant y dark mode.

| Shell                  | Uso                                       | Composición                                                            |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `MainLayoutComponent`  | App autenticada (rutas privadas)          | `<app-sidebar>` + columna `<app-navbar>` + `<router-outlet>`           |
| `AuthLayoutComponent`  | Login, registro, recuperación de password | Two-pane: branding gradient + card de formulario (single column mobile) |
| `OnboardingLayoutComponent` | Wizards de configuración multi-paso  | Header + stepper + card centrado, vía `OnboardingService` (scoped)     |
| `BlankLayoutComponent` | Páginas de error (403, 404) y especiales  | `<router-outlet>` puro                                                  |

### Sidebar declarativo, dinámico por rol y por tenant

La navegación vive en `layout/config/navigation.config.ts` como una lista de
`NavigationGroup` con sus `NavigationItem`. Cada item declara cuándo es visible:

```ts
{
  id: 'attendance',
  label: 'Asistencia',
  icon: 'calendar-check',
  route: ROUTES.ATTENDANCE.ROOT,
  feature: FeatureKey.Attendance,
  permissions: [Permission.AttendanceRead],
  children: [
    { id: 'attendance-daily',   label: 'Hoy',       route: ROUTES.ATTENDANCE.DAILY },
    { id: 'attendance-history', label: 'Historial', route: ROUTES.ATTENDANCE.HISTORY },
    { id: 'attendance-reports', label: 'Reportes',  route: ROUTES.ATTENDANCE.REPORTS }
  ]
}
```

`NavigationService` filtra el árbol en runtime combinando **cuatro** predicados
ortogonales (todos deben pasar):

1. `feature` → habilitada en `environment.features` (build-time).
2. `feature` → presente en `tenant.enabledFeatures` si el tenant declara un
   allowlist explícito (plan / entitlement). `undefined` = sin restricción.
3. `roles` → el usuario tiene al menos uno de los roles.
4. `permissions` → el usuario tiene al menos uno de los permisos.

Resultado: **un único `MainLayoutComponent` para todos los roles y todos los
tenants** — lo que cambia es el contenido del sidebar, no el shell. Grupos
vacíos se podan automáticamente.

#### Sub-items anidados

Cualquier item puede tener `children`. El `SidebarItemComponent` cambia a modo
"grupo expandible" con chevron y auto-expande cuando la URL actual pertenece
al subárbol. Pensado para dos niveles máximo (Academic → Cursos / Clases / …);
para árboles más profundos pasar a un mega-menú dedicado.

#### Módulos disponibles

| Grupo     | Módulo         | Feature                   | Permiso requerido            |
| --------- | -------------- | ------------------------- | ---------------------------- |
| Workspace | Dashboard      | `FeatureKey.Dashboard`    | —                            |
| Workspace | Estudiantes    | `FeatureKey.Students`     | `students:read`              |
| Workspace | Académico (+4) | `FeatureKey.Academic`     | `academic:read`              |
| Workspace | Asistencia (+3)| `FeatureKey.Attendance`   | `attendance:read`            |
| Workspace | Pagos          | `FeatureKey.Payments`     | `payments:read`              |
| Insights  | Asistente IA   | `FeatureKey.Ai`           | `ai:use`                     |
| Insights  | Reportes       | `FeatureKey.Reports`      | `reports:read`               |
| Sistema   | Configuración  | `FeatureKey.Settings`     | `settings:read` / `:manage`  |

### Estado del layout

`LayoutService` (signals) expone:

- `sidebarCollapsed` → desktop, persistido en `localStorage`.
- `sidebarOpen` → mobile drawer, transitorio.
- `toggleSidebarCollapsed()`, `openSidebar()`, `closeSidebar()`.

`BreadcrumbService` construye el trail automáticamente leyendo `route.data.breadcrumb`:

```ts
{
  path: 'students',
  data: { breadcrumb: 'Estudiantes' },
  loadChildren: () => …
}
```

`OnboardingService` está **provisto en el `OnboardingLayoutComponent`** (no en
root) para que el estado del wizard muera al salir del flow. La página de cada
paso solo necesita llamar `setSteps()` y `setActive()`.

### Tenant theming

Los layouts no hardcodean colores: usan `bg-surface`, `text-content`,
`bg-primary-600`, `bg-accent-500`, `bg-gradient-brand`, etc. Cuando
`TenantThemeService.apply()` escribe las CSS variables, **todo el layout se
rebrande automáticamente**. Ver la sección [White-label theming](#white-label-theming)
para la API completa.

---

## Routing

Configuración compuesta en `app/app-routing/` y declarada en `app.config.ts`.

### Estructura

```
app/
├── app.routes.ts                  # compone los tres bloques + redirect inicial
└── app-routing/
    ├── public.routes.ts           # /auth/* + /onboarding/*  (sin sesión)
    ├── private.routes.ts          # toda la app autenticada (tenant + auth)
    └── error.routes.ts            # /403, /404 + wildcard **
```

`app.routes.ts` solo compone:

```ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,
  ...ERROR_ROUTES
];
```

### Lazy loading

Toda feature se importa con `loadChildren` (o `loadComponent` para pages
individuales). Cada feature publica sus rutas en `features/<name>/<name>.routes.ts`
y su grupo de pages se separa en chunks propios. Tras el build de producción
cada home pesa ~600 B–1 kB transferidos.

### Public vs private

| Bloque              | Layout                       | Guards activas en el padre                    |
| ------------------- | ---------------------------- | --------------------------------------------- |
| `PUBLIC_ROUTES`     | `AuthLayoutComponent`        | `guestGuard` (+ `featureFlagGuard` en `auth`) |
|                     | `OnboardingLayoutComponent`  | —                                             |
| `PRIVATE_ROUTES`    | `MainLayoutComponent`        | `tenantGuard` · `authChildGuard`              |
| `ERROR_ROUTES`      | `BlankLayoutComponent`       | —                                             |

Dentro de cada feature las rutas hijas añaden sus propias guards de permiso
(`permissionGuard` + `data.permissions`), lo que mantiene la matriz
auth/tenant/role/permission ortogonal y composable.

### Route data

Convenciones consumidas por servicios transversales:

```ts
data: {
  feature: FeatureKey.Students,   // gating de feature flag y tenant plan
  permissions: [Permission.StudentsRead],
  breadcrumb: 'Estudiantes',      // BreadcrumbService
  title: 'Estudiantes'            // AppTitleStrategy
}
```

`AppTitleStrategy` (en `core/routing/`) lee `data.title` (o fallback a
`data.breadcrumb`) y aplica `document.title = "<page> · EduShift"`.

### Router options

`provideRouter` configurado en `app.config.ts` con:

- `withComponentInputBinding()` — route params se enlazan a `input()` signals
- `withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })`
- `withRouterConfig({ paramsInheritanceStrategy: 'always' })` — child routes ven los params del padre
- `withPreloading(PreloadAllModules)` — preload de chunks tras el primer paint
- `withViewTransitions()` — transición nativa entre rutas cuando el navegador lo soporta
- `{ provide: TitleStrategy, useClass: AppTitleStrategy }`

### Mapa de rutas

| Path               | Layout       | Bloque   | Feature             | Notas                          |
| ------------------ | ------------ | -------- | ------------------- | ------------------------------ |
| `/`                | —            | redirect | —                   | redirige a `/dashboard`        |
| `/auth/*`          | Auth         | public   | `Auth`              | `guestGuard`                   |
| `/onboarding/*`    | Onboarding   | public   | —                   | wizard 3 pasos                 |
| `/dashboard`       | Main         | private  | `Dashboard`         |                                |
| `/students/:id?`   | Main         | private  | `Students`          | `students:read`                |
| `/academic/*`      | Main         | private  | `Academic`          | `academic:read` + sub-items    |
| `/attendance/*`    | Main         | private  | `Attendance`        | `attendance:read` + sub-items  |
| `/payments/*`      | Main         | private  | `Payments`          | `payments:read`                |
| `/ai`              | Main         | private  | `Ai`                | `ai:use`                       |
| `/reports`         | Main         | private  | `Reports`           | `reports:read`                 |
| `/notifications`   | Main         | private  | `Notifications`     |                                |
| `/settings/*`      | Main         | private  | `Settings`          | `settings:read` / `:manage`    |
| `/403`, `/404`     | Blank        | errors   | —                   | catch-all `**` → `/404`        |

---

## Responsive

Mobile-first sin excepciones. Toda la chrome del layout y los primitives de
página están diseñados para escalar desde 320 px hasta 1440 px+ sin código
condicional por dispositivo.

### Mobile / Tablet / Desktop

| Viewport | Sidebar               | Navbar                              | PageContainer    |
| -------- | --------------------- | ----------------------------------- | ---------------- |
| < 768 px | drawer + backdrop     | hamburger + acciones esenciales     | `px-4 py-5`      |
| ≥ 768 px | inline, expandido     | breadcrumbs visibles                | `px-6 py-6`      |
| ≥ 1024 px| inline, colapsable    | search visible, divisor user-menu   | `px-8 py-8`      |
| ≥ 1280 px| ídem                  | ídem                                | hasta `max-w-screen-2xl` |

### BreakpointService

`@core/services/breakpoint.service.ts` expone signals reactivas alineadas con
los breakpoints de Tailwind (`tailwind.config.js`):

```ts
const bp = inject(BreakpointService);
bp.current()  // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
bp.isMobile() // < md
bp.isTablet() // md → lg
bp.isDesktop()// ≥ lg
bp.atLeast('xl')  // signal<boolean>
bp.below('md')    // signal<boolean>
```

Usar para lógica que no se puede resolver con CSS (montar componentes
desktop-only, swap table → cards, decidir estado inicial del sidebar, …).
Para visibilidad pura usar siempre clases Tailwind.

### Primitives de página (shared/components/)

| Primitive             | Tamaño         | Para qué                                     |
| --------------------- | -------------- | -------------------------------------------- |
| `app-page-container`  | `narrow` · `default` · `wide` · `full` | gutter + max-width consistente             |
| `app-page-header`     | block          | título + subtítulo + acciones + slot extra   |
| `app-stat-card`       | block          | métrica de dashboard (label + valor + delta) |
| `app-empty-state`     | block          | placeholder amistoso con acción opcional     |

Patrón canónico para una página:

\`\`\`html
<app-page-container size="wide">
  <app-page-header
    title="Estudiantes"
    subtitle="Listado activo del tenant.">
    <button class="btn btn-primary btn-sm">Nuevo</button>
  </app-page-header>

  <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    @for (s of stats; track s.id) {
      <app-stat-card [label]="s.label" [value]="s.value" [icon]="s.icon" />
    }
  </section>
</app-page-container>
\`\`\`

`MainLayoutComponent` ya **no** impone un contenedor — cada page declara su
propio `<app-page-container>`. Esto permite páginas full-bleed (data tables,
kanban) sin pelearse contra padding heredado.

### Patrones responsive concretos

- **Stat grid de dashboard**: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`
  — 1 columna móvil, 2 tablet, 4 desktop.
- **Two-column overview**: `grid lg:grid-cols-3` con la columna principal
  marcada `lg:col-span-2`. Apilan vertical en < `lg`.
- **Acciones del header**: el header del `PageHeader` apila vertical hasta
  `sm` (`flex-col sm:flex-row sm:items-end sm:justify-between`).
- **Botones con icon + label**: `<app-icon>` + `<span class="hidden sm:inline">`
  → solo icono en móvil, icono + texto en tablet+.
- **Search en navbar**: oculto en móvil/tablet (`hidden lg:flex`), accesible
  vía atajos en su lugar (pendiente, command palette).

### Dark mode + theming + responsive ya cooperan

Como los layouts no hardcodean colores y los breakpoints viven en
`tailwind.config.js`, cambiar paleta (tenant) o modo (dark) no rompe el
diseño responsive — todos los primitives consumen las CSS variables
semánticas (`bg-surface`, `text-content`, `border-border`, etc.).

---

## White-label theming

Cada colegio (tenant) puede definir su propia identidad visual sin tocar
componentes ni recompilar. Toda la marca vive bajo `Tenant.branding` y se
aplica en runtime sobre `<html>` mediante CSS variables — Tailwind las consume
automáticamente.

### Modelo `TenantBranding`

```ts
interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding?: TenantBranding;
  enabledFeatures?: FeatureKey[];
}

interface TenantBranding {
  logo?: TenantLogo;                  // light / dark / mark / markDark + alt
  favicon?: string;                   // URL o data: URI
  primaryColor?: string;              // hex / rgb — genera paleta 50→950
  accentColor?: string;               // hex / rgb — genera paleta 50→950
  fontFamily?: string;                // se antepone al stack por defecto
  radius?: 'sm' | 'md' | 'lg' | 'xl'; // controla --radius-base
  defaultTheme?: Theme;               // propuesta inicial de light/dark
}
```

Todos los campos son **opcionales**. Un tenant que solo entrega `primaryColor`
ya recibe paleta completa coherente, favicon SVG generado con su color y
logo en modo "chip con inicial". Brand kits parciales no rompen el UI.

### Tokens centralizados

El catálogo de variables CSS controlables vive en
`core/theming/theme-tokens.ts`:

```ts
export const THEME_TOKENS = {
  primaryPalette: paletteVars('primary'),  // --color-primary-{50..950}
  accentPalette:  paletteVars('accent'),   // --color-accent-{50..950}
  radius:         '--radius-base',
  fontSans:       '--font-sans'
} as const;
```

Agregar un nuevo token tenant-tweakable son dos ediciones:
1. añadir entry en `THEME_TOKENS` (+ en `ALL_TENANT_VARS`)
2. declarar default en `src/styles/_tokens.scss`

`TenantThemeService` los aplica y limpia de forma simétrica usando ese
catálogo.

### Paletas generadas vs. estáticas

`buildPalette(brandColor)` toma un color y deriva las 11 tonalidades por
interpolación en HSL (mantiene matiz, fija saturación, remapea luminosidad).
Funciona igual para `primary` y para `accent`, así cualquier color de marca
encaja en el sistema de tonos:

```ts
buildPalette('#0ea5e9') // → { 50: '236 254 255', 100: '...', ..., 950: '...' }
```

El resultado se escribe directamente como `--color-primary-50` …
`--color-primary-950` en `<html>`. Las utilidades `bg-primary-100`,
`text-primary-700`, `border-primary-500/40` (con alpha) se rebrandean
automáticamente.

### Aplicación en runtime

`TenantThemeService.apply(tenant)` hace, en orden:

1. `data-tenant="<slug>"` y `data-tenant-id="<id>"` sobre `<html>` — útil para
   overrides estáticos en `_tokens.scss` y para debugging.
2. Paleta primaria desde `branding.primaryColor`.
3. Paleta accent desde `branding.accentColor`.
4. `--font-sans` con la fuente del tenant **antepuesta** a un fallback
   robusto (Inter → system-ui → sans-serif), así un asset roto nunca deja
   al usuario con serif del sistema.
5. `--radius-base` desde el preset `radius` (`sm` = 0.25rem … `xl` = 0.75rem).
6. Favicon dinámico (ver más abajo).

`reset()` es perfectamente simétrico: borra cada variable, los `data-tenant*`
y restaura el favicon al default. Cambiar de tenant en la misma sesión
arranca siempre desde un estado limpio.

### Logos por tenant: `<app-tenant-logo>`

Un solo componente standalone resuelve la lógica de "qué imagen mostrar
ahora" para todos los slots:

```html
<app-tenant-logo variant="mark" size="md" />   <!-- icon cuadrado    -->
<app-tenant-logo variant="full" size="lg" />   <!-- logo horizontal  -->
```

Cuatro variantes en `TenantLogo` cubren los casos reales:
- `light` (requerido) → logo horizontal sobre fondos claros.
- `dark` → variante para `.dark` (fallback a `light`).
- `mark` → icono cuadrado para sidebar colapsado / mobile (fallback a `light`).
- `markDark` → dark-mode del `mark` (fallback a `mark` → `dark` → `light`).

La selección la hace `TenantAssetsService` (signals reactivos a
`TenantService.tenant()` + `ThemeService.isDark()`). Si el tenant **no
entrega logo**, el componente renderiza un chip con gradiente de marca y la
inicial del nombre — mismas dimensiones que el `<img>` para que el layout no
reflowee mientras el asset carga.

Usado por: `SidebarComponent`, `AuthLayoutComponent`, `OnboardingLayoutComponent`.
Cualquier otra pantalla puede dropearlo sin configuración extra.

### Favicon por tenant

Tres rutas posibles, en orden de prioridad:

1. **Asset propio**: si `branding.favicon` está definido, se escribe en
   `<link rel="icon" id="app-favicon">`.
2. **SVG generado**: si solo hay `branding.primaryColor`, se genera un SVG
   data URI con la inicial del tenant sobre su color de marca. El tab del
   navegador refleja la identidad visual sin requerir asset.
3. **Default**: si no hay ninguno, vuelve a `favicon.ico`.

Además se cachea la última URL en `localStorage.edushift.tenant.favicon` para
que el script anti-FOUC de `index.html` pueda aplicarla **antes** del
bootstrap Angular en cargas siguientes — el favicon correcto aparece desde
el primer frame.

### Integración con Tailwind

`tailwind.config.js` mapea cada variable CSS con `rgb(var(--token) / <alpha-value>)`
para que los modificadores de opacidad sigan funcionando:

```js
colors: {
  primary: { DEFAULT: withAlpha('--color-primary-500'), 50: ..., 950: ... },
  accent:  { DEFAULT: withAlpha('--color-accent-500'),  50: ..., 950: ... },
  // ...
},
borderRadius: { base: 'var(--radius-base)' },        // .rounded-base
fontFamily:   { sans: ['var(--font-sans)', 'Inter', ...] }
```

Resultado: cualquier clase Tailwind que use estos tokens (`bg-primary-600`,
`text-accent-500`, `rounded-base`, `font-sans`) **automáticamente respeta
el tenant activo** — sin código condicional en componentes.

### Dark mode + branding

Las paletas `primary` y `accent` traen overrides en `.dark` dentro de
`_tokens.scss` (escala invertida). Cuando el tenant inyecta colores propios,
`TenantThemeService` escribe la paleta una sola vez sobre `<html>` y sirve
para ambos temas — el contraste se mantiene porque las clases semánticas
(`text-content`, `bg-surface-raised`) cambian con la clase `.dark`.

Logos: `TenantAssetsService` recalcula `fullLogoUrl()` / `markUrl()` cuando
`ThemeService.isDark()` cambia, por lo que un `<app-tenant-logo>` muestra la
variante correcta automáticamente.

### Capas de precedencia (resumen)

De menor a mayor (las superiores ganan):

| Capa                     | Quién la escribe                  | Cuándo |
| ------------------------ | --------------------------------- | ------ |
| `:root`                  | `_tokens.scss`                    | build  |
| `.dark`                  | `_tokens.scss`                    | toggle clase |
| `[data-tenant='<slug>']` | `_tokens.scss` (overrides demo)   | build  |
| inline `style=""`        | `TenantThemeService` (runtime)    | login / switch tenant |

Una institución puede tener un brand kit handcrafted en `_tokens.scss`
(`[data-tenant='harvard']`) y simultáneamente entregar `primaryColor` desde
el API — la regla inline gana, pero la regla estática es un safety net útil
para SSR / pre-bootstrap.

---

## Dark mode & theming

Implementación con tres fuentes de verdad bien separadas que coexisten sin
pisarse:

| Fuente            | Owner                       | Storage                  | Precedencia |
| ----------------- | --------------------------- | ------------------------ | ----------- |
| `userTheme`       | `ThemeService` (`setTheme`) | `localStorage` (por dispositivo) | **1.ª**     |
| `tenantTheme`     | `TenantService` (`setTenant`) → `ThemeService.applyTenantDefault()` | in-memory (cambia con el tenant) | 2.ª         |
| Sistema operativo | `prefers-color-scheme`      | live, vía `matchMedia`   | 3.ª (fallback) |

```ts
// effective theme:
theme = userTheme ?? tenantTheme ?? Theme.System
```

### Por qué tres fuentes

- **Persistencia por usuario** sin contaminar entre tenants: `userTheme` se
  guarda en `localStorage` del navegador y vale para todas las cuentas/tenants
  del mismo dispositivo. Si el usuario nunca eligió, pasa al siguiente nivel.
- **Default por tenant**: cuando se resuelve el tenant, `TenantService` llama
  `themeService.applyTenantDefault(tenant.branding?.defaultTheme)`. Esto solo
  se aplica si no hay preferencia explícita del usuario, así una institución
  puede proponer "dark by default" sin secuestrar la elección del individuo.
- **Sigue al sistema** cuando nada está fijado: respeta `prefers-color-scheme`
  y se actualiza en vivo si el usuario cambia el modo del OS.

### Anti-FOUC

`src/index.html` aplica `.dark` y `data-tenant` inline antes de bootstrap
Angular, leyendo `localStorage` directamente. Cero parpadeo en el primer
paint.

### Transición suave

`ThemeService` añade la clase `.theme-switching` al `<html>` durante ~220 ms
cada vez que cambia el modo. En `styles/_base.scss` esa clase activa un
`transition` universal **solo** para color, background, border, fill, stroke
y shadow (nunca para layout, para evitar jank). Fuera de esa ventana las
transiciones de hover/focus mantienen sus duraciones originales.

```scss
.theme-switching, .theme-switching *,
.theme-switching *::before, .theme-switching *::after {
  transition: background-color 200ms ease, color 200ms ease,
              border-color 200ms ease, fill 200ms ease,
              stroke 200ms ease, box-shadow 200ms ease,
              outline-color 200ms ease !important;
}

@media (prefers-reduced-motion: reduce) {
  .theme-switching, .theme-switching * { transition: none !important; }
}
```

El primer `applyTheme()` (al cargar la app) salta el burst de transición
porque el FOUC handler ya pintó el modo correcto en SSR/HTML.

### UI: theme toggle

`ThemeToggleComponent` (en el navbar) es un dropdown con tres opciones
explícitas — **Claro / Oscuro / Sistema** — con check mark en la activa y
una acción extra "Quitar preferencia" que limpia `userTheme` y deja al
tenant default tomar el control de nuevo.

### Tokens de color

Definidos como tripletas `<R> <G> <B>` en `src/styles/_tokens.scss` y mapeados
en `tailwind.config.js` con `rgb(var(--color-x) / <alpha-value>)` para que los
modificadores de opacidad (`bg-primary/50`) sigan funcionando.

Familias semánticas (no por matiz):

- `primary` (50 → 950) — color de marca, regenerado por tenant.
- `accent`  (50 → 950) — segundo color de marca, regenerado por tenant.
- `surface` (DEFAULT, subtle, muted, raised, inverted) — fondos.
- `content` (DEFAULT, muted, subtle, inverted) — textos.
- `border` (DEFAULT, subtle, strong) — bordes.
- `success` / `warning` / `danger` / `info` — feedback.

Cada familia tiene su set de overrides en `.dark` dentro de `_tokens.scss`.
Cambiar la paleta es tocar variables, **nunca tocar componentes**.

---

## Multi-tenant

El SaaS está diseñado tenant-first; el frontend respeta el contexto del tenant en cuatro capas:

| Capa | Mecanismo |
|---|---|
| **Resolución del tenant** | `TenantService.resolveSlug()` según `environment.multiTenant.strategy` (`subdomain` \| `path` \| `header`). Se ejecuta en `APP_INITIALIZER`. |
| **Branding** | `TenantThemeService` inyecta `--color-primary-*` (paleta de 11 shades generada por HSL) y `data-tenant="<slug>"` en `<html>`. |
| **Network** | `tenantInterceptor` añade `X-Tenant-Id` en cada request a la API. |
| **Storage** | Las claves de `localStorage` están namespaced (`edushift.*`) y la actual del tenant queda en `edushift.tenant.current`. |

---

## Control de acceso

Tres niveles complementarios, todos como **functional guards**:

### 1. `tenantGuard`
Asegura que hay tenant resuelto antes de entrar a rutas tenant-scoped.

### 2. `authChildGuard` / `authGuard` / `guestGuard`
- `authGuard` → ruta protegida (redirige a login con `returnUrl`).
- `guestGuard` → ruta sólo para no-autenticados (login, register).
- `authChildGuard` → aplica `authGuard` a todos los hijos.

### 3. `roleGuard` y `permissionGuard`
```typescript
// Coarse (por rol)
{
  path: 'admin',
  canActivate: [roleGuard],
  data: { roles: [UserRole.TenantAdmin, UserRole.SuperAdmin] }
}

// Granular (por permiso)
{
  path: 'students/new',
  canActivate: [permissionGuard],
  data: { permissions: [Permission.StudentsWrite] }
}
```

### 4. `featureFlagGuard`
Habilita/deshabilita features completos vía `environment.features` (preparado
para escalar a feature flags por tenant/plan):
```typescript
{
  path: 'ai',
  canActivate: [featureFlagGuard],
  data: { feature: FeatureKey.Ai }
}
```

---

## State management

Cada feature expone un **store basado en signals** (`<feature>.store.ts`) con la siguiente forma:

```typescript
@Injectable({ providedIn: 'root' })
export class StudentsStore {
  // Signals privados (estado)
  private readonly _items = signal<Student[]>([]);
  private readonly _loading = signal(false);

  // Selectors públicos (read-only)
  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly count = computed(() => this._items().length);

  // Mutadores
  setItems(items: Student[]): void { this._items.set(items); }
  upsert(student: Student): void { /* ... */ }
  reset(): void { /* ... */ }
}
```

Las **páginas** llaman a `<feature>-api.service.ts` y delegan el estado al store. Sin lógica de negocio fuera del feature.

---

## HTTP

Pipeline configurado en `provideCore()`:

```
request → apiUrl → tenant → auth → loading → error → server
```

- **`apiUrl`**: reescribe `api/...` a la URL base + versión (`environment.apiUrl/v1/...`).
- **`tenant`**: añade `X-Tenant-Id`.
- **`auth`**: añade `Authorization: Bearer <token>`.
- **`loading`**: incrementa el contador global de requests (`LoadingService`).
- **`error`**: captura 401 (logout), 403 (forbidden page), 0 / 5xx (toast).

Los features llaman a `ApiService` (wrapper sobre `HttpClient`):

```typescript
list(): Observable<Paginated<Student>> {
  return this.api.get(API.STUDENTS.ROOT, { page: 1 });
}
```

---

## Path aliases

```ts
@app/*        → src/app/*
@core/*       → src/app/core/*
@shared/*     → src/app/shared/*
@layout/*     → src/app/layout/*
@features/*   → src/app/features/*
@env/*        → src/environments/*
```

---

## Buenas prácticas

- **Standalone components** + `ChangeDetectionStrategy.OnPush` por defecto.
- **Lazy loading** por feature (verificado en el bundle, chunks separados).
- **Signals** para estado local y de feature; `effect()` para sincronización con DOM.
- **Functional guards/interceptors** (sin clases). Composables y testeables.
- **Sin imports cruzados entre features**: si dos features necesitan algo en común, va a `shared/` o `core/`.
- **Barrels (`index.ts`) en cada subcapa** para API pública controlada por feature.
- **Tokens semánticos de diseño** (`bg-surface`, `text-content`, `border-border`) que respetan dark mode y tenant theming automáticamente.
- **Anti-FOUC**: la clase `.dark` y el `data-tenant` se aplican antes de bootstrap desde `index.html`.

---

## Roadmap interno

Lo que vendrá en próximas fases:

- Auth: facade que orqueste login/refresh y poblar `AuthService` desde `AuthApiService`.
- I18n: `@angular/localize` con switcher de locale por usuario.
- Tests: setup de unit tests por store + smoke tests por feature.
- Observabilidad: integrar `LoggerService.enableRemote` con un sink (Sentry / Datadog).
- Generador de scaffolding (`schematic`) para nuevos features con esta misma estructura.
