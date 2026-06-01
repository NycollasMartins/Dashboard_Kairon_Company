# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Integrações de anúncios (Meta/Google): 'false' liga o modo real (chama as
# Edge Functions). Default 'false' aqui no build de produção.
ARG VITE_ADS_USE_MOCK=false
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_ADS_USE_MOCK=$VITE_ADS_USE_MOCK

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
