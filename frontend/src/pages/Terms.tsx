import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-10">

        <Link to="/" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline mb-8">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 3L5 8l5 5"/></svg>
          Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-gray-400 mb-10">Última actualización: mayo 2025</p>

        <div className="prose prose-gray max-w-none text-sm text-gray-600 space-y-8">

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">1. Aceptación de los términos</h2>
            <p>Al registrarte y usar Price-A-Radar ("el Servicio"), aceptas quedar vinculado por estos Términos y Condiciones. Si no estás de acuerdo con alguno de estos términos, no debes usar el Servicio.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">2. Descripción del servicio</h2>
            <p>Price-A-Radar es una plataforma de monitorización de precios que permite a los usuarios configurar alertas automáticas sobre productos de tiendas online. El Servicio realiza comprobaciones periódicas de los precios y notifica a los usuarios cuando se alcanzan los objetivos de precio configurados.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">3. Uso aceptable</h2>
            <p>El usuario se compromete a:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Usar el Servicio únicamente para fines legales y personales.</li>
              <li>No intentar acceder a sistemas o datos no autorizados.</li>
              <li>No realizar un uso abusivo del sistema de créditos o alertas.</li>
              <li>Proporcionar información veraz al registrarse.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">4. Cuentas y créditos</h2>
            <p>El plan gratuito incluye 10 créditos de bienvenida. Los créditos se consumen al realizar comprobaciones manuales de precio. El plan Pro incluye créditos mensuales renovables. Los créditos no utilizados no se acumulan entre períodos de facturación.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">5. Privacidad y datos</h2>
            <p>Recopilamos únicamente los datos necesarios para prestar el Servicio: dirección de email, URLs de productos monitorizados y preferencias de alerta. No vendemos ni compartimos tus datos con terceros con fines comerciales. Los datos se almacenan en servidores dentro de la Unión Europea en cumplimiento del RGPD.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">6. Exactitud de los precios</h2>
            <p>Price-A-Radar actúa como intermediario de información. No garantizamos la exactitud absoluta de los precios mostrados, ya que estos dependen de las tiendas externas. El Servicio no es responsable de discrepancias entre los precios mostrados y los precios reales en el momento de la compra.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">7. Cancelación y baja</h2>
            <p>Puedes cancelar tu cuenta en cualquier momento desde la sección de Configuración. La cancelación del plan Pro tiene efecto al final del período de facturación en curso. Los datos asociados a tu cuenta se eliminarán en un plazo de 30 días tras la baja.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">8. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Notificaremos los cambios significativos por email con al menos 15 días de antelación. El uso continuado del Servicio tras dicha notificación implica la aceptación de los nuevos términos.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">9. Contacto</h2>
            <p>Para cualquier consulta sobre estos términos, puedes contactarnos en <a href="mailto:hola@pricearadar.com" className="text-indigo-600 hover:underline">hola@pricearadar.com</a>.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
