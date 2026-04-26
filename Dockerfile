FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p auth_cache && chmod 700 auth_cache

EXPOSE 3001

USER node

CMD ["node", "src/index.js"]
