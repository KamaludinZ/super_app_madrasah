@echo off
echo Starting Backend with Local MongoDB...
echo.

set MONGO_URL=mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin
set DB_NAME=super_app_madrasah
set JWT_SECRET=aB3dF6hJ9kL2mN5pQ8rT1uV4wX7yZ0aC3eG6iK9mO2qS5uW8yA1cE4gI7kM0oR3
set CORS_ORIGINS=http://localhost:3000,http://localhost,http://localhost:80
set SERVICE_URL_BACKEND=http://localhost:8000
set SERVICE_FQDN_BACKEND=localhost
set SERVICE_URL_FRONTEND=http://localhost:3000
set SERVICE_FQDN_FRONTEND=localhost
set ENV=development

echo MongoDB URL: mongodb://admin:***@localhost:27017/super_app_madrasah
echo Database: %DB_NAME%
echo Environment: %ENV%
echo.
echo Backend will be available at: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.

python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
