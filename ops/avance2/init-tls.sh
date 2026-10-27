set -eu
mkdir -p /certs
if [ ! -s /certs/ca.crt ]; then
 openssl req -x509 -newkey rsa:2048 -nodes -keyout /certs/ca.key -out /certs/ca.crt -days 30 -subj '/CN=PROSPECTOR Avance2 Local CA'
 openssl req -newkey rsa:2048 -nodes -keyout /certs/server.key -out /certs/server.csr -subj '/CN=localhost'
 printf 'subjectAltName=DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
' > /certs/server.ext
 openssl x509 -req -in /certs/server.csr -CA /certs/ca.crt -CAkey /certs/ca.key -CAcreateserial -out /certs/server.crt -days 30 -extfile /certs/server.ext
 chmod 644 /certs/ca.crt /certs/server.crt
 chmod 600 /certs/ca.key /certs/server.key
fi
