FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["npm", "run", "web"]