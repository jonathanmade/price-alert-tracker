import jwt
from django.conf import settings


def verify_supabase_token(request) -> dict | None:
    """
    Verifica el JWT de Supabase desde el header Authorization.
    Devuelve el payload si es válido, None si no.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.PyJWTError:
        return None
