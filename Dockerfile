FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY server.js ./
COPY dist ./dist
EXPOSE 3456
CMD ["node", "server.js"]
