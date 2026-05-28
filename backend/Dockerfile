FROM node:22-alpine

WORKDIR /app

# install deps first so Docker can cache this layer
COPY package*.json ./
RUN npm install

# copy source
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
