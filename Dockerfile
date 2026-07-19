FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY app.js index.html styles.css server.js database.js supabase-credentials.js ./
COPY scripts ./scripts

EXPOSE 4173
ENV PORT=4173

CMD ["node", "server.js"]
