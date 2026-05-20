FROM php:8.2-fpm-alpine

# Caddy reverse proxy + PHP-FPM workers (replacing php -S built-in server for stable long-run RSS).
RUN apk update \
  && apk add --no-cache \
    supervisor \
    caddy \
    curl \
    $PHPIZE_DEPS \
    postgresql-dev \
  && docker-php-ext-install -j "$(nproc)" pdo_pgsql \
  && apk del --no-network $PHPIZE_DEPS postgresql-dev \
  && rm -rf /var/cache/apk/*

COPY docker/php-fpm-zz-www.conf /usr/local/etc/php-fpm.d/zz-cupappen.conf
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/supervisord.conf /etc/supervisord.conf

WORKDIR /app

COPY . .

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
  CMD sh -c 'curl -fsS "http://127.0.0.1:${PORT:-8080}/api/health.php" >/dev/null || exit 1'

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
