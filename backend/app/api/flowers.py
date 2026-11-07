
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.flower import Flower
from app.schemas.flower import FlowerCreate, FlowerResponse
import uuid
from sqlalchemy import select

router = APIRouter(prefix="/flowers", tags=["Flowers"])


@router.post(
    "",
    response_model=FlowerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_flower(
    flower_data: FlowerCreate,
    db: Annotated[Session, Depends(get_db)],
):
    flower = Flower(**flower_data.model_dump())

    db.add(flower)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Flower conflicts with an existing record or database constraint",
        )

    db.refresh(flower)

    return flower

@router.get("", response_model=list[FlowerResponse])
def get_flowers(
    db: Annotated[Session, Depends(get_db)],
):
    statement = select(Flower)
    flowers = db.scalars(statement).all()

    return flowers

@router.get("/{flower_id}", response_model=FlowerResponse)
def get_flower(
    flower_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    flower = db.get(Flower, flower_id)

    if flower is None:
        raise HTTPException(
            status_code=404,
            detail="Flower not found",
        )

    return flower
