FROM node:22-alpine AS build
WORKDIR /game
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/sim/package.json packages/sim/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN npm ci
COPY . .
ARG VITE_SOURCE_URL
ENV VITE_SOURCE_URL=$VITE_SOURCE_URL
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=2567
WORKDIR /game
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/sim/package.json packages/sim/package.json
COPY packages/protocol/package.json packages/protocol/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /game/apps/server/dist apps/server/dist
COPY --from=build /game/apps/client/dist apps/client/dist
COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY THIRD_PARTY_LICENSES THIRD_PARTY_LICENSES
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/index.js"]
