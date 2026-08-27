FROM node:22-alpine

WORKDIR /app

# 1. Install deps in their own layer for caching.
COPY package*.json ./

# Reproducible install from the lockfile.
RUN npm ci

# 2. Copy the Prisma schema BEFORE the rest of the source.
# Prisma generates its typed client from the schema at build time.
# Doing this in its own step means changing src/ doesn't invalidate
# the generate layer if the schema is unchanged — faster rebuilds.
COPY prisma ./prisma
RUN npx prisma generate

# 3. Copy the rest of the source.
COPY . .

# 4. Make /app writable by node before we switch to that user.
RUN chown -R node:node /app
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# 5. The node:22-alpine image ships with a non-root user called "node".
USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
