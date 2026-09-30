FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Vite bakes VITE_* into the bundle, so they are build args, not runtime env.
ARG VITE_API_ENABLED=false
ARG VITE_API_URL=
ARG VITE_DEV_USER=
ENV VITE_API_ENABLED=$VITE_API_ENABLED VITE_API_URL=$VITE_API_URL VITE_DEV_USER=$VITE_DEV_USER

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Where Nginx proxies /api and /audio (the compose service name by default).
ENV BACKEND_URL=http://backend:4000
EXPOSE 80
