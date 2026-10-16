FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY public ./public
COPY server ./server
COPY scripts ./scripts

EXPOSE 4173
ENV PORT=4173

CMD ["node", "server/server.js"]
