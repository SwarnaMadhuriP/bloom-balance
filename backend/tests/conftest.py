
import os
from datetime import date, timedelta
from urllib.parse import urlsplit, urlunsplit

import pytest
import app.models

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.main import app as fastapi_app

from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance
from decimal import Decimal

database_url = os.environ["DATABASE_URL"]
parts = urlsplit(database_url)

TEST_DATABASE_URL = urlunsplit(
    (
        parts.scheme,
        parts.netloc,
        "/bloombalance_test",
        parts.query,
        parts.fragment,
    )
)

if parts.path.strip("/") == "bloombalance_test":
    raise RuntimeError(
        "DATABASE_URL must point to the development database"
    )

test_engine = create_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    with test_engine.connect() as connection:
        name = connection.execute(
            text("SELECT current_database()")
        ).scalar_one()

        if name != "bloombalance_test":
            raise RuntimeError(
                f"Unexpected test database: {name}"
            )

    Base.metadata.create_all(bind=test_engine)

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()

    session = Session(
        bind=connection,
        autoflush=False,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(fastapi_app) as test_client:
            yield test_client
    finally:
        fastapi_app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def order_scenario(db_session):
    # Create organizations and flower
    grower = Organization(
        name="Test Grower",
        organization_type="grower",
    )

    florist = Organization(
        name="Test Florist",
        organization_type="florist",
    )

    flower = Flower(
        name="Rose",
        variety="Test Hybrid",
        color="Red",
    )

    db_session.add_all([grower, florist, flower])
    db_session.flush()

    # Create batch and storage location
    batch = FlowerBatch(
    flower_id=flower.id,
    grower_organization_id=grower.id,
    harvest_date=date.today(),
    expiry_date=date.today() + timedelta(days=7),
    initial_quantity=300,
    price_per_unit=Decimal("15.00"),
)

    location = InventoryLocation(
        organization_id=grower.id,
        name="Test Greenhouse",
        location_type="cold_storage",
    )

    db_session.add_all([batch, location])
    db_session.flush()

    balance = InventoryBalance(
        batch_id=batch.id,
        location_id=location.id,
        available_quantity=300,
        reserved_quantity=0,
    )

    db_session.add(balance)
    db_session.commit()

    return {
        "grower": grower,
        "florist": florist,
        "flower": flower,
        "batch": batch,
        "location": location,
        "balance": balance,
    }


@pytest.fixture
def concurrency_db():
    """
    Provide a dedicated, committed database environment
    for concurrency tests.

    Unlike db_session, this fixture allows independent
    PostgreSQL connections to see committed data.
    """
    connection = test_engine.connect()

    database_name = connection.execute(
        text("SELECT current_database()")
    ).scalar_one()

    connection.close()

    if database_name != "bloombalance_test":
        raise RuntimeError("Unsafe test database")

    SessionFactory = sessionmaker(
        bind=test_engine,
        autoflush=False,
        expire_on_commit=False,
    )

    yield SessionFactory

    # Cleanup must happen after concurrent workers finish.
    # Only safe because this test database is dedicated
    # to these tests and tests are not run in parallel.
    with test_engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())

