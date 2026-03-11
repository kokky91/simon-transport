from typing import Annotated, Callable
import json
import logging

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings


class CurrentUser(BaseModel):
    user_id: str
    tenant_id: str
    world_id: str
    role: str


ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 0,
    "editor": 1,
    "ai_reviewer": 2,
    "admin": 3,
}


logger = logging.getLogger(__name__)


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")

    return token


def get_current_user(authorization: Annotated[str | None, Header()] = None) -> CurrentUser:
    token = _extract_bearer_token(authorization)
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    tenant_id = payload.get("tenantId") or payload.get("tenant_id")
    if not isinstance(tenant_id, str) or not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing tenant claim")

    world_id = payload.get("worldId") or payload.get("world_id")
    if not isinstance(world_id, str) or not world_id:
        world_id = f"{tenant_id}:world"

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing user claim")

    role = payload.get("role")
    if not isinstance(role, str) or role not in ROLE_HIERARCHY:
        role = "viewer"

    return CurrentUser(user_id=user_id, tenant_id=tenant_id, world_id=world_id, role=role)


def require_role(required_role: str) -> Callable[[CurrentUser], CurrentUser]:
    required_level = ROLE_HIERARCHY.get(required_role)
    if required_level is None:
        raise ValueError(f"Unknown role: {required_role}")

    def dependency(
        request: Request,
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        current_level = ROLE_HIERARCHY.get(current_user.role, 0)
        if current_level < required_level:
            logger.warning(
                json.dumps(
                    {
                        "event": "rbac_denied",
                        "user_id": current_user.user_id,
                        "role": current_user.role,
                        "required_role": required_role,
                        "endpoint": request.url.path,
                        "method": request.method,
                    }
                )
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role permissions")
        return current_user

    return dependency
