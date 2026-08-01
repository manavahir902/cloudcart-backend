# ---- Stage 1: install dependencies ----
# Using a separate stage for npm install means Docker can CACHE this layer -
# if you only change your .js code (not package.json), rebuilding the image
# skips re-downloading all dependencies, making rebuilds much faster.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
# npm ci (not npm install) uses package-lock.json exactly as-is - guarantees
# the EXACT same dependency versions every build, no surprises. --omit=dev
# skips devDependencies entirely since we have none that matter at runtime.

# ---- Stage 2: the actual runtime image ----
# Starting fresh from a clean base and copying only what's needed (not the
# npm cache, not build tools) keeps the final image small - smaller images
# pull faster during deploys and have a smaller attack surface.
FROM node:20-alpine AS runner
WORKDIR /app

# Why alpine: a minimal Linux distro (~40MB vs ~1GB for full node image).
# Less installed = less that can be vulnerable or misconfigured.

# Run as a non-root user inside the container - if the app were ever
# compromised via some dependency vulnerability, it doesn't get root
# inside the container. Node's official image already ships a "node" user.
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# Your app already listens on process.env.PORT || 3000 (server.js, Phase 6) -
# EXPOSE here is documentation for humans/tools, it doesn't actually publish
# the port by itself - that happens via ECS task definition (Phase 24) or
# `docker run -p`.
EXPOSE 3000

# Container-level health check - lets Docker/ECS know if the app inside is
# actually responsive, not just "the process exists." Reuses the exact
# /health endpoint the ALB has been checking all along (Phase 6/7).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]