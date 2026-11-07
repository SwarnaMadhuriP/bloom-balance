from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine

app = FastAPI(
    title="BloomBalance API",
    description="Flower supply chain and waste management platform",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"message": "Welcome to BloomBalance!"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/health/db")
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "database": str(e)
        }