import jwt
import uuid
import logging
import aiosqlite
from jwt import PyJWKClient
from fastapi import HTTPException, status, Request
from ..config import settings
from ..models import UserResponse

logger = logging.getLogger(__name__)

# Google's JWKS endpoint for Firebase token verification
GOOGLE_JWKS_URL = (
    "https://www.googleapis.com/service_accounts/v1/jwk/"
    "securetoken@system.gserviceaccount.com"
)

# PyJWT's built-in JWKS client handles caching and key rotation
_jwks_client = PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True)


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token using Google's JWKS endpoint.
    Returns the decoded token payload containing uid, email, etc.
    No service account key or cryptography library needed.
    """
    try:
        # 1. Get the signing key from the JWKS endpoint
        signing_key = _jwks_client.get_signing_key_from_jwt(id_token)

        # 2. Verify and decode the token
        project_id = settings.FIREBASE_PROJECT_ID
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )

        # 3. Validate required claims
        if not payload.get("sub"):
            raise ValueError("Token missing 'sub' claim")

        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid Firebase token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
        )
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {e}",
        )


async def sync_user(db: aiosqlite.Connection, firebase_uid: str, email: str) -> dict:
    """
    Sync a Firebase user to the local database.
    Creates a new record on first login or handles concurrent insertion gracefully.
    First user becomes admin.
    Returns the local user record as a dict.
    """
    # 1. Check if user exists by firebase_uid or email
    async with db.execute(
        "SELECT * FROM users WHERE firebase_uid = ? OR (email = ? AND email != '')",
        (firebase_uid, email)
    ) as cursor:
        existing = await cursor.fetchone()
        if existing:
            # If email matched but firebase_uid was updated, update it
            if existing["firebase_uid"] != firebase_uid:
                await db.execute(
                    "UPDATE users SET firebase_uid = ? WHERE id = ?",
                    (firebase_uid, existing["id"])
                )
                await db.commit()
            return {
                "id": existing["id"],
                "firebase_uid": firebase_uid,
                "email": existing["email"],
                "role": existing["role"],
                "created_at": str(existing["created_at"]),
            }

    # 2. Check if this is the first user in the database (admin)
    async with db.execute("SELECT COUNT(*) as count FROM users") as cursor:
        row = await cursor.fetchone()
        is_first_user = row["count"] == 0

    role = "admin" if is_first_user else "customer"
    user_id = str(uuid.uuid4())

    try:
        await db.execute(
            """
            INSERT INTO users (id, firebase_uid, email, role) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET firebase_uid = excluded.firebase_uid
            """,
            (user_id, firebase_uid, email, role),
        )
        await db.commit()
        logger.info(f"Created/synced user: {email} with role: {role}")
    except Exception as e:
        logger.warning(f"Concurrent user sync handled: {e}")

    # Re-fetch the saved record
    async with db.execute(
        "SELECT * FROM users WHERE firebase_uid = ? OR email = ?",
        (firebase_uid, email)
    ) as cursor:
        saved = await cursor.fetchone()
        if saved:
            return {
                "id": saved["id"],
                "firebase_uid": saved["firebase_uid"],
                "email": saved["email"],
                "role": saved["role"],
                "created_at": str(saved["created_at"]),
            }

    return {
        "id": user_id,
        "firebase_uid": firebase_uid,
        "email": email,
        "role": role,
        "created_at": "",
    }


async def get_current_user(request: Request, db: aiosqlite.Connection) -> dict:
    """
    Extract and validate the current user from the Firebase ID token
    in the Authorization header. Auto-syncs user to local DB on first call.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = auth_header.split(" ", 1)[1]
    payload = verify_firebase_token(token)

    firebase_uid = payload["sub"]
    email = payload.get("email", "")

    # Sync user to local DB (creates if not exists)
    user = await sync_user(db, firebase_uid, email)
    return user


async def require_admin(request: Request, db: aiosqlite.Connection) -> dict:
    """Require the current user to have admin role."""
    user = await get_current_user(request, db)
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user
