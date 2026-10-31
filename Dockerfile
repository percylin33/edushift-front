# =============================================================================
# Sprint cierre-D / I1 — Frontend Dockerfile
# =============================================================================
# Multi-stage:
#   1. builder — Node 22, runs `npm ci && npm run build:prod` (PWA bundle)
#   2. runner  — nginx:alpine, serves dist/edushift-front/browser with
#                 SPA fallback to /index.html (PWA / deep-link support)
#                 + service-worker cache headers
#
# Build:  cd edushift-front && npm install && npm run build:prod
#         docker build -t edushift-front:local -f Dockerfile ..
# Run:    docker run --rm -p 4200:80 edushift-front:local
# =============================================================================

# ---- Stage 1: builder ----
FROM node:22-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS builder
WORKDIR /workspace

# Python is required by node-gyp for some native deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build:prod

# ---- Stage 2: runtime (nginx) ----
FROM nginx:stable-alpine@sha256:47928bf67eb62a1863cb08d9ecb52d3e704304ba614eaee17884204677702951 AS runtime
RUN apk upgrade --no-cache

# Replace default config with one that:
#   - listens on 80
#   - serves Angular PWA build (/index.html fallback)
#   - sends long-lived cache headers for hashed asset chunks
#   - sends no-cache for index.html + manifest.webmanifest (PWA needs
#     the SW to pick up new bundles)
#   - security headers (X-Frame-Options, X-Content-Type-Options,
#     Referrer-Policy, Permissions-Policy) — CSP is left to the
#     application since it depends on which third-party APIs the SPA
#     talks to.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;
  # Preserve server-level security headers in cache-specific locations.
  # NGINX 1.29.3+ supports merge inheritance; the pinned image is 1.30.x.
  add_header_inherit merge;
  sendfile on;
  tcp_nopush on;
  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_comp_level 5;
  gzip_types text/css application/javascript image/svg+xml;

  root /usr/share/nginx/html;
  index index.html;

  # Hashed chunk files: cache 1y.
  location ~* "-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpg|svg|webp)$" {
    add_header Cache-Control "public, max-age=31536000, immutable";
    access_log off;
    try_files $uri =404;
  }

  # Service worker + manifest: never cache so updates land immediately.
  location = /ngsw-worker.js { add_header Cache-Control "no-store"; }
  location = /ngsw.json       { add_header Cache-Control "no-store"; }
  location = /manifest.webmanifest { add_header Cache-Control "no-store"; }

  # index.html: short cache so the SW can swap bundles on refresh.
  location = / {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    try_files $uri /index.html;
  }

  # The / request internally redirects to index.html; set the same policy on
  # that URI so the SPA shell cannot become stale in browser or service-worker caches.
  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    try_files $uri =404;
  }

  # SPA fallback for client-side routing.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Security headers
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options          "DENY"   always;
  add_header Referrer-Policy          "no-referrer-when-downgrade" always;
  add_header Permissions-Policy       "camera=(self), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-Xc2sB4L71e3Lgt62KSclQUubR1F5rw29YW5FbgHQlqM='; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; manifest-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
}
EOF

COPY --from=builder /workspace/dist/edushift-front/browser/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

EXPOSE 80
