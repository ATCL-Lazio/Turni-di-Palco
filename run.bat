@echo off
setlocal

REM Percorso assoluto ai certificati per il dev HTTPS
set "SSL_CRT_FILE=%~dp0192.168.3.243+1.pem"
set "SSL_KEY_FILE=%~dp0192.168.3.243+1-key.pem"
set "HTTPS=true"

npm run dev:https

endlocal
