FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY client.js index.html styles.css app-server.js database.js supabase-credentials.js auth.js ./
COPY scripts ./scripts

EXPOSE 4173
ENV PORT=4173

CMD ["node", "app-server.js"]
