# ══════════════════════════════════════════════════════════════
# PREMA VASAM • Official Production Docker Container
# Lightweight Node.js 22 LTS • Built-in SQLite • Zero External Dependencies
# ══════════════════════════════════════════════════════════════

FROM node:22-alpine

# Create non-root system user for security
RUN addgroup -S premavasam && adduser -S premavasam -G premavasam

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package configuration
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev

# Copy all application files
COPY . .

# Ensure ownership by non-root user
RUN chown -R premavasam:premavasam /app

USER premavasam

EXPOSE 3000

# Built-in health check for container orchestrators (Docker Swarm, Kubernetes, Cloud Run)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/stats').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
