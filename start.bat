@echo off
title NovaStream Server Launcher
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
pause

