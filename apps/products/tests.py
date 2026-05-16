import pytest
from unittest.mock import MagicMock, call
from apps.products.scraper import _extract_price
from apps.products.tasks import _deduct_credit


# ── _extract_price ────────────────────────────────────────────────────────────

class TestExtractPrice:
    def test_comma_decimal(self):
        assert _extract_price("29,99 €") == 29.99

    def test_dot_decimal(self):
        assert _extract_price("29.99") == 29.99

    def test_integer_price(self):
        assert _extract_price("30 €") == 30.0

    def test_nbsp_separator(self):
        # non-breaking space between digits should not break parsing
        assert _extract_price("1\xa0299,00 €") == 1299.0

    def test_price_in_context(self):
        assert _extract_price("Precio: 149,95 €") == 149.95

    def test_returns_none_for_no_digits(self):
        assert _extract_price("Sin precio") is None

    def test_returns_none_empty(self):
        assert _extract_price("") is None

    def test_first_match_wins(self):
        # Should return the first price found
        assert _extract_price("Antes: 59,99 € Ahora: 39,99 €") == 59.99


# ── _deduct_credit ────────────────────────────────────────────────────────────

class TestDeductCredit:
    def _make_supabase(self, rpc_data):
        sb = MagicMock()
        sb.rpc.return_value.execute.return_value.data = rpc_data
        return sb

    def test_returns_true_when_credits_available(self):
        sb = self._make_supabase(rpc_data=9)
        assert _deduct_credit(sb, "user-abc") is True

    def test_calls_rpc_with_correct_args(self):
        sb = self._make_supabase(rpc_data=5)
        _deduct_credit(sb, "user-xyz")
        sb.rpc.assert_called_once_with("deduct_credit", {"p_user_id": "user-xyz"})

    def test_inserts_credit_transaction_on_success(self):
        sb = self._make_supabase(rpc_data=4)
        _deduct_credit(sb, "user-abc")
        sb.table.assert_called_with("credit_transactions")

    def test_returns_false_when_no_credits(self):
        sb = self._make_supabase(rpc_data=None)
        assert _deduct_credit(sb, "user-abc") is False

    def test_no_transaction_inserted_when_no_credits(self):
        sb = self._make_supabase(rpc_data=None)
        _deduct_credit(sb, "user-abc")
        sb.table.assert_not_called()
