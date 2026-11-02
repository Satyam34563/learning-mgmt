# Build from the repo root: docker build -f server/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci -w server --include-workspace-root=false
COPY server server
RUN npm run build -w server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci -w server --omit=dev --include-workspace-root=false && npm cache clean --force
COPY --from=build /app/server/dist server/dist
WORKDIR /app/server
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
ENV UPLOAD_DIR=/data/uploads PORT=4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
