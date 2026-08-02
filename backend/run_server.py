"""
Script to run server with proper environment variables from .env file
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Force load .env from backend directory
env_path = Path(__file__).parent / '.env'
print(f"Loading environment from: {env_path}")
print(f"Environment file exists: {env_path.exists()}")

# Clear any existing environment variables that might interfere
for key in ['MONGO_URL', 'DB_NAME', 'JWT_SECRET', 'CORS_ORIGINS']:
    if key in os.environ:
        old_value = os.environ[key][:80] if key == 'MONGO_URL' else os.environ[key]
        print(f"Clearing existing {key}: {old_value}")
        del os.environ[key]

# Load fresh from .env with override=True
loaded = load_dotenv(env_path, override=True)
print(f"dotenv load result: {loaded}")

# Verify loaded values
mongo_url = os.getenv('MONGO_URL', 'NOT SET')
print(f"MONGO_URL loaded: {mongo_url[:80] if mongo_url != 'NOT SET' else mongo_url}...")
print(f"DB_NAME: {os.getenv('DB_NAME', 'NOT SET')}")
print(f"MONGO_URL contains 'mongodb+srv': {'mongodb+srv' in mongo_url}")

# Now run uvicorn
import uvicorn

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
