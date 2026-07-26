FROM php:8.2-fpm-alpine

# Public app template — Railway Root Directory MUST be this folder (or sites/<app>/ after copy).
# Ops: docs/PUBLIC_APP_TEMPLATE.md
#
# CRITICAL: Keep postgresql-libs after build (libpq.so). Never `apk del postgresql-libs`.
RUN apk update \
  && apk add --no-cache \
    supervisor \
    caddy \
    curl \
    postgresql-libs \
  && apk add --no-cache --virtual .php-build-deps \
    $PHPIZE_DEPS \
    postgresql-dev \
  && docker-php-ext-install -j "$(nproc)" pdo_pgsql \
  && apk del .php-build-deps \
  && rm -rf /var/cache/apk/*

COPY docker/php-fpm-zz-www.conf /usr/local/etc/php-fpm.d/zz-public-app.conf
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/supervisord.conf /etc/supervisord.conf

WORKDIR /app

COPY . .

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
  CMD sh -c 'curl -fsS "http://127.0.0.1:${PORT:-8080}/api/health.php" >/dev/null || exit 1'

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
