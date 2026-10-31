server {
    server_name app.maxmagia.ru;

    root /var/www/app.maxmagia.ru;
    index index.html;

    server_tokens off;
    add_header X-Content-Type-Options nosniff;
    add_header Cache-Control "no-cache";

    # ── MaxMagia: практики клуба — только для участников (пропуск проверяет сервер кабинета) ──
    location = /_practice_auth {
        internal;
        proxy_pass http://127.0.0.1:8081/api/practice/auth;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
    }
    location ^~ /practices/ {
        auth_request /_practice_auth;
        error_page 401 = /practice-gate.html;
        gzip on;
        gzip_types text/css application/javascript text/javascript image/svg+xml;
        add_header Cache-Control "private, no-cache" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        try_files $uri $uri/ =404;
        # шрифты, эмблема, three.js — телефон запоминает на 30 дней (пропуск всё равно проверяется)
        location ^~ /practices/fonts/ {
            auth_request /_practice_auth;
            error_page 401 = /practice-gate.html;
            add_header Cache-Control "private, max-age=2592000" always;
            add_header X-Robots-Tag "noindex, nofollow" always;
        }
        location ^~ /practices/img/ {
            auth_request /_practice_auth;
            error_page 401 = /practice-gate.html;
            add_header Cache-Control "private, max-age=2592000" always;
            add_header X-Robots-Tag "noindex, nofollow" always;
        }
        location ^~ /practices/lib/ {
            auth_request /_practice_auth;
            error_page 401 = /practice-gate.html;
            add_header Cache-Control "private, max-age=2592000" always;
            add_header X-Robots-Tag "noindex, nofollow" always;
        }
    }
    location = /practice-gate.html {
        add_header Cache-Control "no-store" always;
    }
    # ── конец: MaxMagia: практики клуба ──

    # ответы практик: синхронизация и файлы ботом (psync)
    location /api/psync/ {
        client_max_body_size 20m;
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 90s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 1m;
    }

    location / {
        try_files $uri $uri/ =404;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/app.maxmagia.ru/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/app.maxmagia.ru/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = app.maxmagia.ru) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;
    server_name app.maxmagia.ru;
    return 404; # managed by Certbot


}