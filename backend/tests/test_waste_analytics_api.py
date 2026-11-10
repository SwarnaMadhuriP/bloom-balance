
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.models.waste_analytics import WasteAnalytics
from app.api.waste_analytics import get_db


def test_waste_analytics_endpoints(db_session, order_scenario):
    organization_id = order_scenario["grower"].id

    today = date.today()
    yesterday = today - timedelta(days=1)

    db_session.add_all([
        WasteAnalytics(
            organization_id=organization_id,
            waste_date=yesterday,
            unit="stem",
            total_quantity=20,
        ),
        WasteAnalytics(
            organization_id=organization_id,
            waste_date=today,
            unit="stem",
            total_quantity=10,
        ),
        WasteAnalytics(
            organization_id=organization_id,
            waste_date=today,
            unit="kg",
            total_quantity=5,
        ),
    ])
    db_session.flush()

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as client:
            summary_response = client.get(
                "/analytics/waste/summary",
                params={"organization_id": str(organization_id)},
            )

            assert summary_response.status_code == 200
            assert summary_response.json() == [
                {"unit": "kg", "total_quantity": 5},
                {"unit": "stem", "total_quantity": 30},
            ]

            daily_response = client.get(
                "/analytics/waste/daily",
                params={"organization_id": str(organization_id)},
            )

            assert daily_response.status_code == 200
            assert daily_response.json() == [
                {
                    "waste_date": yesterday.isoformat(),
                    "unit": "stem",
                    "total_quantity": 20,
                },
                {
                    "waste_date": today.isoformat(),
                    "unit": "kg",
                    "total_quantity": 5,
                },
                {
                    "waste_date": today.isoformat(),
                    "unit": "stem",
                    "total_quantity": 10,
                },
            ]
    finally:
        app.dependency_overrides.clear()
