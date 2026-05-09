from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import json

from apps.users.supabase_auth import verify_supabase_token
from apps.products.tasks import _check_single_alert


@csrf_exempt
@require_POST
def check_price_now(request):
    payload = verify_supabase_token(request)
    if not payload:
        return JsonResponse({"error": "No autorizado"}, status=401)

    try:
        body = json.loads(request.body)
        alert_id = body.get("alert_id")
    except (ValueError, KeyError):
        return JsonResponse({"error": "alert_id requerido"}, status=400)

    if not alert_id:
        return JsonResponse({"error": "alert_id requerido"}, status=400)

    # Lanzar tarea Celery de forma asíncrona
    _check_single_alert.delay(alert_id)

    return JsonResponse({"status": "en_proceso"})
