# Design & UX Report — PriceRadar

## Resumen ejecutivo

El frontend de PriceRadar presenta una base visual sólida: paleta indigo/slate coherente, componentes bien estructurados y flujos críticos con loading states y feedback de errores. Sin embargo, existen divergencias notables entre la Landing (que usa CSS custom con variables propias) y el resto de la app (Tailwind puro), lo que crea dos sistemas de diseño paralelos sin tokens compartidos. La accesibilidad muestra carencias sistemáticas: botones de cierre sin texto accesible, falta de `role` y `aria-*` en modales y en el estado de carga, y el `domainLabel` duplicado en dos archivos distintos. En responsividad, las páginas internas (`Analytics`, `History`, `Settings`) no usan `px-4` en móvil sino `px-8` fijo, lo que genera scroll horizontal en pantallas pequeñas. El panel staff de Django carece completamente de soporte móvil. Los flujos críticos (crear alerta, vincular Telegram) están bien cubiertos en feedback, pero la confirmación de eliminación de cuenta hace `signOut` en lugar de borrar realmente la cuenta, y el modal de nueva alerta no tiene `role="dialog"` ni trampa de foco.

---

## 1. Consistencia Visual

### Hallazgos

- **[HIGH]** Dos sistemas de diseño en paralelo: La `Landing` usa `Landing.css` con variables CSS propias (`--c-indigo`, `--c-green`, `--f-display: 'Sora'`, `--f-body: 'DM Sans'`) mientras el resto del app usa Tailwind sin `tailwind.config.js` personalizado (no existe en el proyecto). Esto hace imposible compartir tokens de color o tipografía entre ambas superficies. Si el color indigo cambia, hay que actualizarlo en dos lugares distintos.
  - Archivo: `frontend/src/pages/Landing.css` (líneas 28–46) vs todos los `.tsx` interiores.

- **[HIGH]** La Landing usa la fuente `Sora` vía CSS variable pero nunca se importa en ningún `<link>` ni en `index.css`. La fuente fallback `sans-serif` se activa siempre. Lo mismo ocurre con `DM Sans`.
  - Archivo: `frontend/src/pages/Landing.css` línea 38–39; `frontend/src/index.css` (sin imports de Google Fonts).

- **[MEDIUM]** La función `domainLabel(url)` está duplicada íntegramente en `AlertCard.tsx` (línea 23) y `AlertModal.tsx` (línea 26). Debería extraerse a `frontend/src/utils/url.ts`.

- **[MEDIUM]** Los botones de acción en `AlertCard` usan `text-xs` y `py-1.5` (altura ~28px), por debajo del mínimo recomendado de 44px de área táctil. Archivo: `AlertCard.tsx` líneas 206–224.

- **[MEDIUM]** La sección de tabs en `Settings.tsx` no tiene `role="tablist"` / `role="tab"` ni está conectada con `aria-controls` al panel hijo. Archivo: `Settings.tsx` líneas 22–37.

- **[LOW]** Los nombres de marca son inconsistentes: la Landing usa **"Price-A-Radar"** (`Landing.tsx` línea 220), el Sidebar React usa **"PriceRadar"** (`Sidebar.tsx` línea 82), el panel staff usa **"PriceAlert"** (`staff/base.html` línea 17) y el catálogo público usa también **"PriceAlert"** (`catalog/base.html` línea 40). Elegir un único nombre y aplicarlo en todos los puntos.

- **[LOW]** El espaciado del header de página varía entre secciones: `Dashboard` usa `px-4 sm:px-8`, mientras `Analytics`, `History` y `Settings` usan `px-8` fijo sin breakpoint pequeño. Revisar para uniformizar.

---

## 2. Accesibilidad

### Hallazgos

- **[CRITICAL]** El modal `AlertModal` no tiene `role="dialog"`, `aria-modal="true"` ni `aria-labelledby`. Sin estos atributos los lectores de pantalla no anuncian que se abrió un diálogo y no atrapan el foco dentro de él. El botón de cierre (`×`) carece de `aria-label`.
  - Archivo: `AlertModal.tsx` líneas 113–114, 118–123.
  - Código sugerido para el contenedor del modal:
    ```tsx
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      className="bg-white rounded-2xl ..."
    >
    ```
  - Y para el botón de cierre:
    ```tsx
    <button onClick={onClose} aria-label="Cerrar modal" ...>×</button>
    ```

- **[CRITICAL]** El spinner de carga (en `Dashboard`, `Analytics`, `History`, `Notifications`) es un `<div>` visual sin ningún atributo accesible. Los usuarios de lectores de pantalla no saben que la página está cargando.
  - Ejemplo en `Dashboard.tsx` línea 17. Código sugerido:
    ```tsx
    <div role="status" aria-label="Cargando alertas" className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
    </div>
    ```

- **[HIGH]** El checkbox personalizado en `Login.tsx` (líneas 176–198) oculta el input nativo con `sr-only` pero el `<label>` envuelve tanto el div visual como el texto, lo cual es correcto. Sin embargo, el input carece de `id` explícito y el label no tiene `htmlFor`. Si el DOM se modifica, la asociación se puede romper. Agregar `id="accept-terms"` al input y `htmlFor="accept-terms"` al label.

- **[HIGH]** El botón "Eliminar" en `AlertCard.tsx` (línea 219) no tiene confirmación accesible ni un `aria-label` que identifique qué alerta se eliminará. Con múltiples alertas en pantalla, un lector de pantalla escucha tres botones "Eliminar" sin contexto.
  - Código sugerido: `aria-label={`Eliminar alerta ${alert.products?.name ?? alert.id}`}`

- **[HIGH]** El botón de hamburguesa en `AppLayout.tsx` (línea 12–20) tiene `aria-label="Abrir menú"` (correcto), pero el overlay de backdrop (`div` con `onClick`) no tiene `role="button"` ni `aria-label`. Aunque visualmente se puede cerrar el menú haciendo clic fuera, no es accesible por teclado.

- **[MEDIUM]** En `History.tsx`, la fila expandible usa `<button>` (correcto semánticamente), pero no comunica el estado expandido. Agregar `aria-expanded={isExpanded}` y `aria-controls` al panel de gráfica.
  - Archivo: `History.tsx` línea 74.

- **[MEDIUM]** Los íconos SVG en el `Sidebar` (navegación) no tienen `aria-hidden="true"`. Al estar dentro de un `<NavLink>` con texto visible no son un problema grave, pero añaden ruido semántico innecesario para tecnologías asistivas.

- **[MEDIUM]** Las etiquetas de porcentaje de diferencia de precio en `AlertCard.tsx` (líneas 147–156) usan solo color para comunicar significado (verde = bueno, naranja = malo). Debería complementarse con un texto o `aria-label` descriptivo para daltonismo.

- **[LOW]** En `catalog/catalog.html` línea 86, el `<h2>` dentro de una tarjeta de producto (`<a>`) crea una jerarquía incorrecta: el nivel `h1` de la página es "Encuentra el mejor precio" y los productos usan `h2`, pero estos `h2` están dentro de un `<a>`, lo cual es válido pero puede confundir a lectores de pantalla que navegan por cabeceras.

---

## 3. Responsividad

### Hallazgos

- **[HIGH]** `Analytics.tsx` (línea 74 y 79), `History.tsx` (línea 42 y 50) y `Settings.tsx` (líneas 14, 20, 41) usan `px-8` sin breakpoint, lo que causa scroll horizontal en pantallas menores a ~400px. `Dashboard.tsx` lo resuelve correctamente con `px-4 sm:px-8`. Aplicar el mismo patrón a las tres páginas afectadas.

- **[HIGH]** El panel staff de Django (`staff/base.html`) no tiene ningún comportamiento responsive. El sidebar de 256px (`w-64`) es fijo y no colapsa en móvil. No hay hamburguesa, no hay breakpoints. El panel es inutilizable en tablet o móvil.
  - Archivo: `templates/staff/base.html` línea 12.

- **[MEDIUM]** En `AlertCard.tsx`, el bloque de precios (`flex items-end gap-4`, línea 131) no tiene wrap. En móviles muy estrechos (320px) los tres valores de precio (precio actual, objetivo, diferencia) se desbordan del contenedor. Agregar `flex-wrap`.

- **[MEDIUM]** `Billing.tsx` tiene un grid de planes `grid sm:grid-cols-3` (línea 93). En pantallas entre 375–639px (sm breakpoint en Tailwind es 640px) los tres planes se apilan en una columna, que es correcto. Pero el texto "Próximamente" en los botones deshabilitados no tiene suficiente contraste con `text-gray-400` sobre `bg-gray-50` (relación ~3:1, por debajo del mínimo WCAG AA de 4.5:1 para texto pequeño).

- **[MEDIUM]** La nav de la Landing (`Landing.css`, `.nav-links`) no tiene visibilidad en móvil: se oculta con `display:none` en breakpoints pequeños pero no hay menú hamburguesa alternativo. Los usuarios móviles no tienen acceso a los enlaces de navegación de la landing.
  - Archivo: `frontend/src/pages/Landing.css`, buscar `.nav-links`.

- **[LOW]** `AppLayout.tsx` agrega `mt-12` al `<main>` en móvil para compensar la top bar fija. Si la top bar creciera en altura (ej. un banner de aviso), el offset se desalinearía. Usar `pt-[var(--topbar-h)]` o un valor dinámico.

---

## 4. UX / Flujos críticos

### Hallazgos

#### Crear alerta
- **[HIGH]** `AlertModal.tsx` hace `scrapeMetadata` `onBlur` del campo URL (línea 70), pero si el usuario borra y vuelve a escribir varias veces el estado `metaStatus` se resetea a `idle` y la petición anterior puede solaparse con la nueva. No hay debounce ni cancelación de petición previa. Esto puede mostrar metadata de una URL antigua.

- **[HIGH]** El campo "Precio objetivo" acepta cualquier número positivo incluyendo valores mayores al precio actual scrapeado, lo que es válido pero no hay advertencia UX cuando el objetivo es mayor que el precio actual (el usuario nunca recibirá la alerta). Mostrar un warning inline si `targetPrice >= currentPrice`.

- **[MEDIUM]** El modal no tiene trampa de foco (`focus trap`). Al abrirse, el foco queda donde estaba en el documento y el usuario de teclado puede tabular fuera del modal a elementos del fondo.

- **[MEDIUM]** El paso "Añadir otra tienda" solo aparece cuando `metaStatus === 'done'` (línea 217). Si el scraper falla (`metaStatus === 'failed'`), el usuario no puede añadir tiendas adicionales. Considerar mostrar la opción también en estado `failed`.

- **[LOW]** El mensaje de éxito/error de "Comprobar ahora" en `AlertCard.tsx` desaparece automáticamente a los 6 segundos (línea 49). Para usuarios lentos esto puede ser demasiado rápido. Aumentar a 8–10 segundos o añadir un botón de cierre manual.

#### Vinculación con Telegram
- **[MEDIUM]** El flujo de vincular Telegram en `Notifications.tsx` muestra una lista numerada con solo el paso 1 antes del botón (línea 103–107), y los pasos 2 y 3 aparecen debajo del botón (líneas 119–128). El flujo visual es discontinuo: el usuario lee "paso 1 → botón → paso 2 → paso 3", cuando debería ser "pasos 1, 2, 3 → botón". Reorganizar para mostrar todos los pasos juntos primero.

- **[MEDIUM]** Una vez generado el enlace de Telegram, si el usuario recarga la página el enlace se pierde y hay que generarlo de nuevo. Considerar persistirlo en `sessionStorage` o mostrar el enlace más prominentemente.

- **[LOW]** El enlace de Telegram caduca en 15 minutos (indicado en línea 136) pero no hay contador de cuenta regresiva. El usuario puede dejarlo abierto en otra pestaña y volver a intentar con un enlace expirado. Un contador visual mejoraría la UX.

#### Eliminar cuenta
- **[CRITICAL]** En `Account.tsx` línea 131, el botón "Sí, eliminar cuenta" llama a `supabase.auth.signOut()` en lugar de ejecutar una lógica de borrado real de la cuenta. Esto simplemente cierra la sesión sin eliminar ningún dato. Es engañoso para el usuario y podría ser un problema legal (RGPD requiere poder eliminar datos).

#### Estados vacíos
- **[MEDIUM]** La página `History.tsx` muestra estado vacío cuando no hay alertas pero no ofrece ninguna CTA para crear una alerta o ir al Dashboard. Añadir un enlace al Dashboard.
  - Archivo: `History.tsx` líneas 53–59.

---

## 5. Django Templates

### Hallazgos

- **[HIGH]** `staff/base.html` y `catalog/base.html` cargan Tailwind via CDN (`<script src="https://cdn.tailwindcss.com">`). En producción esto: (a) bloquea el render, (b) descarga ~4MB sin purgar clases no usadas, (c) no permite configurar la paleta de colores para que coincida con el frontend React. Usar el CLI de Tailwind con `purge`/`content` para generar un CSS estático.
  - Archivo: `templates/staff/base.html` línea 7; `templates/catalog/base.html` línea 32.

- **[HIGH]** El panel staff (`staff/base.html`) no tiene ninguna responsividad (ver sección 3). El sidebar de `w-64` nunca colapsa. Para un panel de administración que podría usarse desde tablet en campo, esto es un problema operativo.

- **[MEDIUM]** El nombre de marca en las plantillas Django es "PriceAlert" (no "PriceRadar" ni "Price-A-Radar"). Esta inconsistencia es visible públicamente en el SEO: `<title>Comparar precios · PriceAlert</title>` (`catalog/base.html` línea 8) vs la Landing que usa "Price-A-Radar". Unificar el nombre antes de indexar.

- **[MEDIUM]** `staff/dashboard.html` muestra precios con `€{{ check.price }}` sin formateo de decimales (línea 86). Si el precio es un entero en la DB se muestra `€219` en lugar de `€219.00`, generando inconsistencia visual respecto al frontend React que siempre usa `.toFixed(2)`. Usar el filtro `{{ check.price|floatformat:2 }}`.

- **[MEDIUM]** `catalog/product_detail.html` no fue revisado completamente pero `catalog/base.html` no define `og:image` por defecto (línea 22 tiene el bloque vacío). Todas las páginas del catálogo que no sobreescriban `og_image` se compartirán sin imagen en redes sociales, reduciendo el CTR.

- **[LOW]** El footer de `catalog/base.html` tiene hardcodeado `© 2025 PriceAlert` (línea 59). Usar `{% now "Y" %}` para que se actualice automáticamente cada año.

- **[LOW]** El panel staff no tiene ningún mensaje de confirmación antes de acciones destructivas (ej. eliminar producto). Las plantillas de formulario (`staff/products/form.html`, `staff/coupons/form.html`) deberían tener al menos un `window.confirm` o un modal de confirmación para eliminaciones.

---

## Recomendaciones Top 5

### 1. Unificar el sistema de diseño con `tailwind.config.js`
Crear `frontend/tailwind.config.js` con la paleta de colores (`indigo`, `slate`, `green`) y las fuentes (`Sora`, `DM Sans`) como tokens. Eliminar `Landing.css` y migrar los estilos a clases Tailwind, o al menos usar las mismas variables CSS en ambos sistemas. Esto resuelve la inconsistencia de marca, permite cambios globales de color y elimina los imports duplicados de fuentes.

### 2. Corregir la eliminación de cuenta (`Account.tsx` línea 131)
Reemplazar `supabase.auth.signOut()` por una llamada real a la API de Django que borre todos los datos del usuario (alertas, productos, perfil, historial de créditos) y luego haga signOut. Esto es un bug funcional y potencialmente un incumplimiento de RGPD.

### 3. Añadir accesibilidad básica a los elementos críticos
Prioridad inmediata:
- `AlertModal`: añadir `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-label` al botón de cierre y `focus trap`.
- Spinners de carga: añadir `role="status"` y `aria-label` descriptivos.
- Botones de "Eliminar" en `AlertCard`: añadir `aria-label` con el nombre del producto.
Estas tres correcciones cubren los casos de uso más frecuentes con el mínimo esfuerzo.

### 4. Arreglar el padding responsive en páginas internas
Cambiar `px-8` por `px-4 sm:px-8` en los headers y contenidos de `Analytics.tsx`, `History.tsx` y `Settings.tsx`. Esta es una corrección de 3 líneas por archivo que elimina el scroll horizontal en móvil y uniformiza el comportamiento con `Dashboard.tsx` que ya lo hace correctamente.

### 5. Compilar Tailwind para las plantillas Django (staff y catalog)
Sustituir `<script src="https://cdn.tailwindcss.com">` por un CSS estático compilado y purgado. Esto reduce el tiempo de carga del panel staff de ~4MB a ~10–30KB, mejora el Core Web Vitals del catálogo público (que impacta en SEO), y permite definir la misma paleta de colores que el frontend React para lograr consistencia visual entre el catálogo Django y la app React.

---

*Auditoría realizada sobre la rama `main` · commit `95a1f3c` · 2026-06-01*
