@echo off
chcp 65001 >nul 2>&1
echo ================================================
echo   WebGen Gambia - Complete Deployment
echo   KOK Enterprises
echo ================================================
echo.
cd /d "%~dp0"

echo [STEP 1/3] Checking if Wrangler is installed...
where wrangler >nul 2>&1
if %errorlevel% neq 0 (
    echo Wrangler not found. Installing...
    npm install -g wrangler
    echo.
)

echo [STEP 2/3] Deploying Worker API to Cloudflare...
echo   This is your backend (auth, database, API endpoints)
echo.
wrangler deploy
if %errorlevel% neq 0 (
    echo.
    echo !! Worker deploy failed. Check:
    echo    - Did you run 'wrangler login'?
    echo    - Are the KV namespace IDs in wrangler.toml?
    echo    - Run: wrangler kv namespace create "WEBGEN_KV"
    echo.
    pause
    exit /b 1
)
echo.
echo   Worker API live at: https://webgen-gambia.workers.dev
echo.

echo [STEP 3/3] Deploying frontend to Cloudflare Pages...
echo   These are your HTML files (admin, client, landing, etc)
echo.
npx wrangler pages deploy . --project-name=webgen-gambia
if %errorlevel% neq 0 (
    echo.
    echo !! Pages deploy failed. Your browser may open for login.
    echo    Try again after logging in.
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   DEPLOY COMPLETE!
echo ================================================
echo.
echo   Frontend:  https://webgen-gambia.pages.dev
echo   API:       https://webgen-gambia.workers.dev
echo.
echo   Pages:
echo     Landing:     https://webgen-gambia.pages.dev/landing.html
echo     Admin:       https://webgen-gambia.pages.dev/admin.html
echo     Staff:       https://webgen-gambia.pages.dev/medewerker.html
echo     Client:      https://webgen-gambia.pages.dev/klant.html
echo     Hub:         https://webgen-gambia.pages.dev/hub.html
echo.
echo   FIRST TIME? Check the API health:
echo     https://webgen-gambia.workers.dev/api/setup/status
echo     Then setup via: POST /api/setup/init
echo.
pause
