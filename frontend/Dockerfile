FROM node:22-alpine

WORKDIR /app

# Install deps in their own layer for caching.
COPY package*.json ./

# Reproducible install from the lockfile. Commit package-lock.json.
RUN npm ci

# Copy the rest of the source.
COPY . .

# Drop root for the running process. node:22-alpine ships a "node" user.

RUN chown -R node:node /app

USER node

EXPOSE 5173

# --host makes Vite reachable from outside the container (not just 127.0.0.1
# inside it, which would be invisible from your browser).
CMD ["npm", "run", "dev", "--", "--host"]
