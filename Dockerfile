FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY client.js index.html styles.css database.js supabase-credentials.js auth.js ./
COPY lib/app-server.cjs ./lib/app-server.cjs
COPY scripts ./scripts

EXPOSE 4173
ENV PORT=4173

CMD ["node", "lib/app-server.cjs"]