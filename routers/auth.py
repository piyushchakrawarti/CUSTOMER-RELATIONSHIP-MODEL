from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import (
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    auth_is_configured,
    create_session_token,
    hash_password,
    verify_password,
)
from database import get_db
from models import AdminAccount

router = APIRouter(prefix="/api/auth", tags=["Admin authentication"])


class AdminLogin(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class AdminRegistration(BaseModel):
    username: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._-]+$")
    email: str = Field(
        min_length=3,
        max_length=255,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    )
    password: str = Field(min_length=1, max_length=1024)


def set_session_cookie(request: Request, response: Response, username: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=create_session_token(username),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: AdminRegistration,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Set a SESSION_SECRET of at least 32 characters in .env, then restart the app.",
        )

    account_exists = await db.scalar(select(AdminAccount.id).limit(1))
    if account_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An admin account already exists. Account creation is closed.",
        )

    username = data.username.strip().lower()
    email = data.email.strip().lower()
    account = AdminAccount(
        id=1,
        username=username,
        email=email,
        password_hash=hash_password(data.password),
    )
    db.add(account)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An admin account already exists or these account details are already in use.",
        ) from None

    set_session_cookie(request, response, account.username)
    return {"authenticated": True, "username": account.username}


@router.post("/login")
async def login(
    data: AdminLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not auth_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Set a SESSION_SECRET of at least 32 characters in .env, then restart the app.",
        )

    identifier = data.identifier.strip().lower()
    account = await db.scalar(
        select(AdminAccount).where(
            or_(
                func.lower(AdminAccount.username) == identifier,
                func.lower(AdminAccount.email) == identifier,
            )
        )
    )
    if account is None or not verify_password(data.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
        )

    set_session_cookie(request, response, account.username)
    return {"authenticated": True, "username": account.username}


@router.post("/logout")
async def logout(request: Request, response: Response):
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"authenticated": False}
