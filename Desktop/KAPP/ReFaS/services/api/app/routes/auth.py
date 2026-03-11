from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, status
from psycopg2 import IntegrityError
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.user_repository import UserRepository

router = APIRouter(prefix="/auth", tags=["auth"])
user_repository = UserRepository()


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)
    tenantId: str | None = Field(default=None)
    role: str | None = Field(default=None)


def _build_auth_response(user: dict) -> dict:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=12)
    token_payload = {
        "sub": user["id"],
        "tenant_id": user["tenant_id"],
        "role": user.get("role", "ai_reviewer"),
        "exp": expires_at,
    }
    token = jwt.encode(token_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    return {
        "accessToken": token,
        "tokenType": "Bearer",
        "expiresAt": expires_at.isoformat(),
        "user": {
            "id": user["id"],
            "email": user["email"],
            "tenantId": user["tenant_id"],
            "role": user.get("role", "ai_reviewer"),
        },
    }


@router.post("/login")
def login(payload: LoginRequest) -> dict:
    user = user_repository.find_active_user_by_email(payload.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    password_hash = user["password_hash"]
    is_valid = bcrypt.checkpw(payload.password.encode("utf-8"), password_hash.encode("utf-8"))
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return _build_auth_response(user)


@router.post("/register")
def register(payload: RegisterRequest) -> dict:
    tenant_id = payload.tenantId
    if tenant_id is not None:
        try:
            UUID(tenant_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="tenantId must be a valid UUID") from exc

    password_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        user = user_repository.create_user(
            email=payload.email,
            password_hash=password_hash,
            tenant_id=tenant_id,
        )
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered") from exc

    return _build_auth_response(user)