set -eu
cp /certs/ca.crt /usr/local/share/ca-certificates/prospector-local.crt
update-ca-certificates >/tmp/prospector-ca.log
exec runuser -u service -- env DISPLAY=:99 HOME=/tmp/prospector-browser-home python /opt/browser_agent.py
