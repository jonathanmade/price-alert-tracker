from django.conf import settings
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


def send_price_alert(to_email: str, product_name: str, product_url: str,
                     current_price: float, target_price: float) -> bool:
    if not settings.SENDGRID_API_KEY:
        print(f"[ALERTA] {product_name}: {current_price}€ ≤ {target_price}€ → {to_email}")
        return True

    subject = f"¡Bajada de precio! {product_name} ahora a {current_price:.2f} €"

    body = f"""
    <h2>🎉 El precio ha bajado</h2>
    <p><strong>{product_name}</strong> ha alcanzado tu precio objetivo.</p>
    <table>
      <tr><td>Precio actual</td><td><strong>{current_price:.2f} €</strong></td></tr>
      <tr><td>Tu objetivo</td><td>{target_price:.2f} €</td></tr>
    </table>
    <br>
    <a href="{product_url}" style="
      background:#4F46E5;color:white;padding:12px 24px;
      border-radius:8px;text-decoration:none;font-weight:600;
    ">Ver producto →</a>
    <br><br>
    <small style="color:#9CA3AF">
      Recibes este email porque tienes una alerta activa en PriceAlert.
    </small>
    """

    message = Mail(
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        html_content=body,
    )

    try:
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)
        return True
    except Exception as e:
        print(f"[SendGrid error] {e}")
        return False
