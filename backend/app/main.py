from fastapi import FastAPI
from sqlalchemy import text

from app.database import engine

from app.api.flowers import router as flowers_router
from app.api.flower_batches import router as flower_batches_router
from app.api.inventory import router as inventory_router

from app.api.orders import router as orders_router

from app.api.marketplace import router as marketplace_router
from app.api.surplus_listings import router as surplus_router
from app.api.waste_records import router as waste_records_router
from app.api.bloomtrace_analytics import (
    router as bloomtrace_analytics_router,
)
from app.api.flower_expiry import router as flower_expiry_router



app = FastAPI(
    title="BloomBalance API",
    description="Flower supply chain and waste management platform",
    version="1.0.0"
)
app.include_router(flowers_router)
app.include_router(flower_batches_router)
app.include_router(inventory_router)
app.include_router(orders_router)
app.include_router(marketplace_router)
app.include_router(surplus_router)
app.include_router(waste_records_router)
app.include_router(bloomtrace_analytics_router)
app.include_router(flower_expiry_router)


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