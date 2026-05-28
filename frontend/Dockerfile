FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host makes Vite reachable from outside the container
CMD ["npm", "run", "dev", "--", "--host"]
