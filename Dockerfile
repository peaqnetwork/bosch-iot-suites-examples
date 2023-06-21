FROM node:lts-alpine AS builder

# Add git since it is now required but not available on node alpine
RUN apk --no-cache add git

WORKDIR /usr/src/app

COPY package*.json ./
COPY . .
RUN npm install && npm run build
# nginx state for serving content
FROM nginx:alpine
# Set working directory to nginx asset directory
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
# Copy static assets from builder stage
COPY --from=builder /usr/src/app/build .
# Containers run nginx with global directives and daemon off
ENTRYPOINT ["nginx", "-g", "daemon off;"]