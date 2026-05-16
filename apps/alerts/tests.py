import json
import pytest
from unittest.mock import MagicMock, patch
from django.test import RequestFactory

from apps.alerts.views import check_price_now, scrape_metadata_view, track_outbound_click


# ── helpers ───────────────────────────────────────────────────────────────────

def _post(factory, path, body, token=None):
    kwargs = {"content_type": "application/json"}
    if token:
        kwargs["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    return factory.post(path, data=json.dumps(body), **kwargs)


def _make_supabase(
    alert=None,
    profile=None,
    product=None,
    extra_urls=None,
):
    """Builds a minimal Supabase mock for check_price_now."""
    sb = MagicMock()

    # alerts table
    alert_chain = sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value
    alert_chain.data = alert

    # profiles table (second table call)
    profile_chain = MagicMock()
    profile_chain.execute.return_value.data = profile

    # alert_urls table (third table call)
    url_chain = MagicMock()
    url_chain.execute.return_value.data = extra_urls or []

    # Route table("...") calls by name
    def _table(name):
        m = MagicMock()
        if name == "alerts":
            m.select.return_value.eq.return_value.single.return_value.execute.return_value.data = alert
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        elif name == "profiles":
            m.select.return_value.eq.return_value.single.return_value.execute.return_value.data = profile
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        elif name == "products":
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        elif name == "price_history":
            m.insert.return_value.execute.return_value = MagicMock()
        elif name == "credit_transactions":
            m.insert.return_value.execute.return_value = MagicMock()
        elif name == "alert_urls":
            m.select.return_value.eq.return_value.execute.return_value.data = extra_urls or []
            m.update.return_value.eq.return_value.execute.return_value = MagicMock()
        return m

    sb.table.side_effect = _table
    return sb


FAKE_ALERT = {
    "id": "alert-1",
    "user_id": "user-abc",
    "target_price": "50.00",
    "status": "active",
    "products": {
        "id": "prod-1",
        "url": "https://example.com/item",
        "name": "Test Product",
        "scrape_ok_count": 3,
        "scrape_error_count": 0,
    },
}

FAKE_PROFILE = {"email": "test@example.com", "credits": 5}


# ── check_price_now ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCheckPriceNow:
    def setup_method(self):
        self.factory = RequestFactory()

    def test_returns_401_without_token(self):
        request = self.factory.post(
            "/api/check-price/",
            data=json.dumps({"alert_id": "alert-1"}),
            content_type="application/json",
        )
        response = check_price_now(request)
        assert response.status_code == 401

    def test_returns_400_for_invalid_json(self):
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}):
            request = self.factory.post(
                "/api/check-price/",
                data="not-json",
                content_type="application/json",
                HTTP_AUTHORIZATION="Bearer faketoken",
            )
            response = check_price_now(request)
        assert response.status_code == 400

    def test_returns_400_when_alert_id_missing(self):
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}):
            request = _post(self.factory, "/api/check-price/", {}, token="faketoken")
            response = check_price_now(request)
        assert response.status_code == 400

    def test_returns_402_when_no_credits(self):
        profile_no_credits = {"email": "test@example.com", "credits": 0}
        sb = _make_supabase(alert=FAKE_ALERT, profile=profile_no_credits)
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views._get_supabase", return_value=sb):
            request = _post(self.factory, "/api/check-price/", {"alert_id": "alert-1"}, token="tok")
            response = check_price_now(request)
        assert response.status_code == 402
        assert json.loads(response.content)["credits"] == 0

    def test_returns_422_when_scraper_fails(self):
        sb = _make_supabase(alert=FAKE_ALERT, profile=FAKE_PROFILE)
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views._get_supabase", return_value=sb), \
             patch("apps.alerts.views.scrape_price", return_value=None):
            request = _post(self.factory, "/api/check-price/", {"alert_id": "alert-1"}, token="tok")
            response = check_price_now(request)
        assert response.status_code == 422

    def test_returns_price_and_credits_on_success(self):
        sb = _make_supabase(alert=FAKE_ALERT, profile=FAKE_PROFILE)
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views._get_supabase", return_value=sb), \
             patch("apps.alerts.views.scrape_price", return_value=99.99), \
             patch("apps.alerts.views.send_price_alert"):
            request = _post(self.factory, "/api/check-price/", {"alert_id": "alert-1"}, token="tok")
            response = check_price_now(request)
        data = json.loads(response.content)
        assert response.status_code == 200
        assert data["price"] == 99.99
        assert data["credits_remaining"] == 4

    def test_triggered_true_when_price_below_target(self):
        alert_cheap = {**FAKE_ALERT, "target_price": "200.00"}
        sb = _make_supabase(alert=alert_cheap, profile=FAKE_PROFILE)
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views._get_supabase", return_value=sb), \
             patch("apps.alerts.views.scrape_price", return_value=99.99), \
             patch("apps.alerts.views.send_price_alert") as mock_mail:
            request = _post(self.factory, "/api/check-price/", {"alert_id": "alert-1"}, token="tok")
            response = check_price_now(request)
        data = json.loads(response.content)
        assert data["triggered"] is True
        mock_mail.assert_called_once()

    def test_triggered_false_when_price_above_target(self):
        alert_high_target = {**FAKE_ALERT, "target_price": "10.00"}
        sb = _make_supabase(alert=alert_high_target, profile=FAKE_PROFILE)
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views._get_supabase", return_value=sb), \
             patch("apps.alerts.views.scrape_price", return_value=99.99), \
             patch("apps.alerts.views.send_price_alert") as mock_mail:
            request = _post(self.factory, "/api/check-price/", {"alert_id": "alert-1"}, token="tok")
            response = check_price_now(request)
        data = json.loads(response.content)
        assert data["triggered"] is False
        mock_mail.assert_not_called()


# ── scrape_metadata_view ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestScrapeMetadataView:
    def setup_method(self):
        self.factory = RequestFactory()

    def test_returns_401_without_token(self):
        request = self.factory.post(
            "/api/scrape-metadata/",
            data=json.dumps({"url": "https://example.com"}),
            content_type="application/json",
        )
        response = scrape_metadata_view(request)
        assert response.status_code == 401

    def test_returns_400_when_url_missing(self):
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}):
            request = _post(self.factory, "/api/scrape-metadata/", {}, token="tok")
            response = scrape_metadata_view(request)
        assert response.status_code == 400

    def test_returns_scraped_data(self):
        fake_meta = {"name": "Cool Gadget", "price": 49.99, "image": None}
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views.scrape_metadata", return_value=fake_meta):
            request = _post(
                self.factory, "/api/scrape-metadata/",
                {"url": "https://example.com/product"}, token="tok",
            )
            response = scrape_metadata_view(request)
        data = json.loads(response.content)
        assert response.status_code == 200
        assert data["name"] == "Cool Gadget"
        assert data["price"] == 49.99


# ── track_outbound_click ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestTrackOutboundClick:
    def setup_method(self):
        self.factory = RequestFactory()

    def test_returns_401_without_token(self):
        request = self.factory.post(
            "/api/track-outbound/",
            data=json.dumps({"product_id": "prod-1"}),
            content_type="application/json",
        )
        response = track_outbound_click(request)
        assert response.status_code == 401

    def test_returns_400_when_product_id_missing(self):
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}):
            request = _post(self.factory, "/api/track-outbound/", {}, token="tok")
            response = track_outbound_click(request)
        assert response.status_code == 400

    def test_increments_click_count(self):
        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "id": "prod-1", "outbound_clicks": 3
        }
        with patch("apps.alerts.views.verify_supabase_token", return_value={"sub": "user-abc"}), \
             patch("apps.alerts.views._get_supabase", return_value=sb):
            request = _post(self.factory, "/api/track-outbound/", {"product_id": "prod-1"}, token="tok")
            response = track_outbound_click(request)
        assert response.status_code == 200
        sb.table.return_value.update.assert_called_once_with({"outbound_clicks": 4})
