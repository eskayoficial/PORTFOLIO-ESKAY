#!/usr/bin/env sh
# Uso: sh iniciar_mac_linux.sh          -> servidor Java (porta 8080)
#      sh iniciar_mac_linux.sh python   -> servidor Python (porta 8000)
cd "$(dirname "$0")" || exit 1
if [ "$1" = "python" ]; then
  python3 python/servidor.py
else
  java java/PortfolioServer.java
fi
