 $env:SSL_CRT_FILE="$(Resolve-Path ./192.168.3.243+1.pem)"
  $env:SSL_KEY_FILE="$(Resolve-Path ./192.168.3.243+1-key.pem)"
  $env:HTTPS="true"
  npm run dev:https