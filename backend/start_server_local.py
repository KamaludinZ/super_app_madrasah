"""
Start uvicorn server with local MongoDB environment variables
"""
import os
import subprocess

# Set environment variables for local MongoDB
os.environ['MONGO_URL'] = 'mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin'
os.environ['DB_NAME'] = 'super_app_madrasah'
os.environ['JWT_SECRET'] = 'aB3dF6hJ9kL2mN5pQ8rT1uV4wX7yZ0aC3eG6iK9mO2qS5uW8yA1cE4gI7kM0oR3'
os.environ['CORS_ORIGINS'] = 'http://localhost:3000,http://localhost,http://localhost:80'
os.environ['SERVICE_URL_BACKEND'] = 'http://localhost:8000'
os.environ['SERVICE_FQDN_BACKEND'] = 'localhost'
os.environ['SERVICE_URL_FRONTEND'] = 'http://localhost:3000'
os.environ['SERVICE_FQDN_FRONTEND'] = 'localhost'
os.environ['ENV'] = 'development'

print("=" * 60)
print("Starting Backend with LOCAL MongoDB")
print("=" * 60)
print(f"MongoDB URL: mongodb://admin:***@localhost:27017/super_app_madrasah")
print(f"Database: {os.environ['DB_NAME']}")
print(f"Environment: {os.environ['ENV']}")
print(f"\nBackend will be available at: http://localhost:8000")
print(f"API Docs: http://localhost:8000/docs")
print("=" * 60)
print("\nStarting server...")
print()

# Start uvicorn
subprocess.run([
    'python', '-m', 'uvicorn',
    'server:app',
    '--reload',
    '--host', '0.0.0.0',
    '--port', '8000'
])
