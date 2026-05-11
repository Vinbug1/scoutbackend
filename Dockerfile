FROM node:20

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "start"]












# # Use official Node.js image
# FROM node:20

# # Set working directory
# WORKDIR /usr/src/app

# # Copy package.json and package-lock.json
# COPY package*.json ./

# # Install dependencies
# RUN npm install

# # Copy all source files
# COPY . .

# # Generate Prisma client
# RUN npx prisma generate

# # Expose port
# EXPOSE 4000

# # Start app
# CMD ["npm", "run", "dev"]
