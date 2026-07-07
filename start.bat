@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo    Eligiendo Mi Camino - version offline
echo ============================================
echo.
where node >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando... se abrira tu navegador (usa Chrome o Edge).
  node serve.mjs --open
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando con Python... abre http://localhost:5173 en Chrome o Edge.
  start "" http://localhost:5173/
  python -m http.server 5173 --directory dist
  goto :end
)
echo No se encontro Node.js ni Python en este equipo.
echo Instala Node.js desde https://nodejs.org y vuelve a hacer doble clic en este archivo.
pause
:end
