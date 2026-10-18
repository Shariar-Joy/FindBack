FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Browser requests stay on the HTTPS site origin and use Nginx's /api proxy.
ENV VITE_API_URL=""
RUN npm run build

FROM nginx:1.28-alpine
ENV ALB_TRUSTED_CIDR_1=127.0.0.1/32 ALB_TRUSTED_CIDR_2=127.0.0.1/32
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8080/nginx-health || exit 1
