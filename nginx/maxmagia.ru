# Сайт maxmagia.ru (лендинг психолога на /psy/)
server {
    server_name maxmagia.ru www.maxmagia.ru;

    root /var/www/maxmagia.ru;
    index index.html;
    charset utf-8;

    location = /psy { return 301 /psy/; }

    # Шрифты и картинки кэшируются браузером
    location ~* \.(woff2|jpg|jpeg|png|webp)$ { expires 30d; try_files $uri =404; }

    location / { try_files $uri $uri/ =404; }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/maxmagia.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/maxmagia.ru/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot



    # ── MaxMagia: практики на сайте /art/ — только для участников (вход по коду из кабинета) ──
    location = /_web_auth {
        internal;
        proxy_pass http://127.0.0.1:8081/api/web/auth;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
    }
    # ответы практик: синхронизация и файлы ботом (psync)
    location /art-sync/ {
        client_max_body_size 20m;
        proxy_pass http://127.0.0.1:8081/api/psync/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 90s;
    }

    location ^~ /art-api/ {
        proxy_pass http://127.0.0.1:8081/api/web/;
        proxy_set_header X-Real-IP $remote_addr;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }
    location = /art-gate.html {
        add_header Cache-Control "no-store" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }
    location = /art {
        return 301 /art/;
    }
    # mm-open-nasilie
    location = /art/nasilie { return 301 /art/nasilie/; }
    location ^~ /art/nasilie/ {
        alias /var/www/maxmagia.ru/art-open/nasilie/;
        index index.html;
        add_header Cache-Control "no-cache";
    }
    location ^~ /art/ {
        alias /var/www/app.maxmagia.ru/practices/;
        index index.html;
        auth_request /_web_auth;
        error_page 401 = /art-gate.html;
        # те же файлы, что в кабинете; пути /practices/ на лету меняются на /art/
        sub_filter_types text/css application/javascript;
        sub_filter '"/practices/' '"/art/';
        sub_filter "'/practices/" "'/art/";
        sub_filter '(/practices/' '(/art/';
        sub_filter '"/telegram-web-app.js"' '"https://app.maxmagia.ru/telegram-web-app.js"';
        sub_filter_once off;
        gzip on;
        gzip_types text/css application/javascript image/svg+xml;
        add_header Cache-Control "private, no-cache" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        location ^~ /art/fonts/ {
            alias /var/www/app.maxmagia.ru/practices/fonts/;
            auth_request /_web_auth;
            error_page 401 = /art-gate.html;
            add_header Cache-Control "private, max-age=2592000" always;
            add_header X-Robots-Tag "noindex, nofollow" always;
        }
        location ^~ /art/img/ {
            alias /var/www/app.maxmagia.ru/practices/img/;
            auth_request /_web_auth;
            error_page 401 = /art-gate.html;
            add_header Cache-Control "private, max-age=2592000" always;
            add_header X-Robots-Tag "noindex, nofollow" always;
        }
        location ^~ /art/lib/ {
            alias /var/www/app.maxmagia.ru/practices/lib/;
            auth_request /_web_auth;
            error_page 401 = /art-gate.html;
            add_header Cache-Control "private, max-age=2592000" always;
            add_header X-Robots-Tag "noindex, nofollow" always;
        }
    }
    # ── конец: MaxMagia: практики на сайте /art/ ──
}

server {
    if ($host = www.maxmagia.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    if ($host = maxmagia.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    server_name maxmagia.ru www.maxmagia.ru;
    return 404; # managed by Certbot




}