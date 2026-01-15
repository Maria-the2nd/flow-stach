@echo off
echo Starting Flow Bridge development servers...
echo.

echo Starting Convex dev server...
start "Convex Dev" cmd /k "bunx convex dev"

timeout /t 2 /nobreak >nul

echo Starting Next.js dev server...
start "Next.js Dev" cmd /k "bun run dev"

echo.
echo Both servers are starting in separate windows.
echo Close the windows to stop the servers.
pause
