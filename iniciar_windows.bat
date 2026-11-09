@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Portfolio Kauan
echo.
echo   Portfolio Kauan - escolha o servidor:
echo     [1] Java   (http://localhost:8080)
echo     [2] Python (http://localhost:8000)
echo.
choice /c 12 /n /m "  Opcao (1 ou 2): "
if errorlevel 2 goto python
java java/PortfolioServer.java
goto fim
:python
python python/servidor.py
:fim
pause
