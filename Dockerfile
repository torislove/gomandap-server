# Stage 1: Builder
# Use a specific version for reproducibility
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies needed for build (including devDependencies)
# Copy package files first to leverage cache
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
# Note: .dockerignore filters out node_modules, dist, etc.
COPY . .

# Build the TypeScript application
# This compiles .ts files in src/ to .js files in dist/
RUN npm run build

# Stage 2: Runner (Production)
# Start fresh with a lightweight image
FROM node:20-alpine AS runner

# Set NODE_ENV to production for optimization
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy package files again
COPY package.json package-lock.json* ./

# Install ONLY production dependencies (reduces image size significantly)
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist
# Copy other necessary files if any (e.g., templates, public)
# COPY --from=builder /app/public ./public 

# Create a non-root user for security (Alpine "node" user usually exists, or create one)
# RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# USER appuser

# Expose the application port
EXPOSE 5000

# Command to run the application (using the compiled JS entry point)
# Note: Ensure dev-server.js or index.js is the correct entry point in /dist
CMD ["node", "dist/dev-server.js"]
