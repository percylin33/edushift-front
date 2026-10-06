# =============================================================================
# Sprint cierre-D / I1 — Frontend Dockerfile
# =============================================================================
# Multi-stage:
#   1. builder — Node 20, runs `npm ci && npm run build:prod` (PWA bundle)
#   2. runner  — nginx:alpine, serves dist/edushift-front/browser with
#                 SPA fallback to /index.html (PWA / deep-link support)
#                 + service-worker cache headers
#
# Build:  cd edushift-front && npm install && npm run build:prod
#         docker build -t edushift-front:local -f Dockerfile ..
# Run:    docker run --rm -p 4200:80 edushift-front:local
# =============================================================================

# ---- Stage 1: builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

# Python is required by node-gyp for some native deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:prod

# ---- Stage 2: runtime (nginx) ----
FROM nginx:1.27-alpine AS runtime

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
  sendfile on;
  tcp_nopush on;

  root /usr/share/nginx/html;
  index index.html;

  # Hashed chunk files: cache 1y.
  location ~* \.[0-9a-f]{8,}\.(?:js|css|woff2?|png|jpg|svg|webp)$ {
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

  # SPA fallback for client-side routing.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Security headers
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options          "DENY"   always;
  add_header Referrer-Policy          "no-referrer-when-downgrade" always;
  add_header Permissions-Policy       "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
}
EOF

COPY --from=builder /workspace/dist/edushift-front/browser/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

EXPOSE 80
