# Build stage for the frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Set the API URL for the frontend build
ENV REACT_APP_API_URL=https://lumoviz.carolinafederation.org/api
RUN npm run build

# Build stage for the backend
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server ./server
COPY --from=frontend-build /app/build ./server/public

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/server/credentials/credentials.json

# Expose the port
EXPOSE 8080

# Start the server
WORKDIR /app/server
CMD ["npm", "start"] 