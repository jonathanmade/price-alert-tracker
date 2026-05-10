from django.shortcuts import get_object_or_404, redirect
from django.views import View

from .models import ProductURL, AffiliateClick


class AffiliateRedirectView(View):
    """
    Registra el clic y redirige a la URL de afiliado.
    URL pública: /go/<product_slug>/<marketplace_slug>/
    """
    def get(self, request, product_slug, marketplace_slug):
        product_url = get_object_or_404(
            ProductURL,
            product__slug=product_slug,
            marketplace__slug=marketplace_slug,
            active=True,
        )

        AffiliateClick.objects.create(
            product_url=product_url,
            ip_hash=AffiliateClick.hash_ip(request.META.get("REMOTE_ADDR", "")),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
            referer=request.META.get("HTTP_REFERER", "")[:500],
        )

        return redirect(product_url.build_affiliate_url())
