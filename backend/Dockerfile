FROM node:20

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Environment
ENV NODE_ENV=production

# The app listens on PORT (default 3000)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]


