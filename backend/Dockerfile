FROM node:22-alpine

WORKDIR /app

# 1. Install deps in their own layer so this step only re-runs when
#    package.json or package-lock.json changes. Big speedup over time.
COPY package*.json ./

# npm ci installs the EXACT versions from package-lock.json, which is
# what we want in containers — reproducible, identical across machines.
# Requires package-lock.json to exist (commit it to Git).
RUN npm ci

# 2. Copy the rest of the source.
COPY . .

# 3. The node:22-alpine image ships with a non-root user called "node".
#    Switching to it means the app doesn't run as root — smaller blast
#    radius if anything ever gets exploited. The image already owns the
#    needed files because node is uid 1000.

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
