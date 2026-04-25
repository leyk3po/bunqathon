from __future__ import annotations

from datetime import datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class SellerRegister(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "email": "seller@example.com",
                "display_name": "Campus Merch Table",
                "password": "supersecret123",
            }
        }
    )

    email: str = Field(max_length=255)
    display_name: str = Field(
        max_length=80,
        validation_alias=AliasChoices("display_name", "displayName", "name"),
    )
    password: str = Field(max_length=128)


class SellerLogin(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "email": "seller@example.com",
                "password": "supersecret123",
            }
        }
    )

    email: str = Field(max_length=255)
    password: str = Field(max_length=128)


class SellerPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    seller: SellerPublic
