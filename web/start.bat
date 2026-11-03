@echo off
REM RAJGAR Ludo - run on this PC for testing
cd /d "%~dp0"
echo.
echo  RAJGAR Ludo is starting at  http://localhost:8080
echo  Keep this window open while testing. Press Ctrl+C to stop.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:8080"
where npx >nul 2>nul
if %errorlevel%==0 (
  npx --yes http-server . -p 8080 -c-1
) else (
  python -m http.server 8080
)
