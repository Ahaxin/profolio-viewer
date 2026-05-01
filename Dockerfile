FROM node:20-slim

# Native build deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root manifests first (for layer caching)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
# npm workspaces needs all member package.json files to resolve the workspace graph
COPY client/package.json ./client/

# Install server workspace deps only, production only
RUN npm ci --workspace=server --omit=dev

# Copy server source
COPY server/ ./server/

WORKDIR /app/server
EXPOSE 3001
CMD ["node", "index.js"]
