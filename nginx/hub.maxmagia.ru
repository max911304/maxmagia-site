server {
    listen 80;
    listen [::]:80;
    server_name hub.maxmagia.ru;
    location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hub.maxmagia.ru;
    ssl_certificate /etc/letsencrypt/live/hub.maxmagia.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hub.maxmagia.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 25m;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "same-origin" always;
    location ^~ /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }
}
