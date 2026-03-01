FROM node:20-alpine
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Expose Vite's default dev port
EXPOSE 5173

# Run Vite dev server, host 0.0.0.0 is needed for Docker port mapping
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
