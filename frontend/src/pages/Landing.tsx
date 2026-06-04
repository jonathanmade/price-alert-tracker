import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../api/supabase'
import './Landing.css'

/* =============================================
   DATA
============================================= */
const PRODUCTS = [
  { name: 'Sony WH-1000XM5', stores: [
    { name: 'Amazon',        price: 219, best: true  },
    { name: 'MediaMarkt',    price: 279, best: false },
    { name: 'PcComponentes', price: 249, best: false },
  ]},
  { name: 'iPhone 16 128 GB', stores: [
    { name: 'Amazon',        price: 729, best: false },
    { name: 'MediaMarkt',    price: 699, best: true  },
    { name: 'PcComponentes', price: 749, best: false },
  ]},
  { name: 'PlayStation 5 Slim', stores: [
    { name: 'Amazon',        price: 419, best: true  },
    { name: 'MediaMarkt',    price: 449, best: false },
    { name: 'PcComponentes', price: 459, best: false },
  ]},
  { name: 'AirPods Pro 2', stores: [
    { name: 'Amazon',        price: 199, best: true  },
    { name: 'MediaMarkt',    price: 249, best: false },
    { name: 'PcComponentes', price: 229, best: false },
  ]},
]

const TICKERS = [
  { name: 'AirPods Pro 2',           drop: '−€50',  pct: '−20%' },
  { name: 'Xiaomi 14T Pro',           drop: '−€80',  pct: '−16%' },
  { name: 'iPad Air M2 11"',          drop: '−€120', pct: '−18%' },
  { name: 'RTX 4070 Super',           drop: '−€60',  pct: '−9%'  },
  { name: 'LG OLED C4 55"',           drop: '−€200', pct: '−22%' },
  { name: 'Dyson V15 Detect',         drop: '−€90',  pct: '−17%' },
  { name: 'Nintendo Switch 2',        drop: '−€30',  pct: '−8%'  },
  { name: 'Samsung Galaxy S25 Ultra', drop: '−€150', pct: '−13%' },
]

const CHART_PRICES = [549,549,535,549,515,529,505,495,519,505,485,465,479,455,445,435,449,425,419,419]

/* =============================================
   HELPERS
============================================= */
function buildChartPaths() {
  const W = 900, H = 195, PAD = 12
  const minV = Math.min(...CHART_PRICES), maxV = Math.max(...CHART_PRICES)
  const pts = CHART_PRICES.map((v, i) => {
    const x = PAD + (i / (CHART_PRICES.length - 1)) * (W - PAD * 2)
    const y = PAD + ((maxV - v) / (maxV - minV)) * (H - PAD * 2)
    return [x, y] as [number, number]
  })
  const line = 'M ' + pts.map(p => p.join(' ')).join(' L ')
  const last = pts[pts.length - 1]
  const area = line + ` L ${last[0]} ${H + 4} L ${pts[0][0]} ${H + 4} Z`
  const tipLeft = ((last[0] / W) * 100 - 7).toFixed(1) + '%'
  const tipTop  = Math.max(2, (last[1] / H) * 100 - 20).toFixed(1) + '%'
  return { line, area, last, tipLeft, tipTop }
}

function countUp(el: Element) {
  const to  = parseFloat((el as HTMLElement).dataset.to  || '0')
  const dec = parseInt((el as HTMLElement).dataset.dec   || '0')
  const suf = (el as HTMLElement).dataset.suf || ''
  const dur = 2000, t0 = performance.now()
  const tick = (now: number) => {
    const p = Math.min((now - t0) / dur, 1)
    el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(dec) + suf
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* =============================================
   ICONS (inline SVG helpers)
============================================= */
const IconCheck = () => (
  <svg className="ic-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)
const IconCross = () => (
  <svg className="ic-cross" width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

/* =============================================
   COMPONENT
============================================= */
export default function Landing() {
  const [loggedIn, setLoggedIn]       = useState(false)
  const [widgetIdx, setWidgetIdx]     = useState(0)
  const [widgetOpacity, setWidgetOp]  = useState(1)
  const [emailVal, setEmailVal]       = useState('')
  const [emailSent, setEmailSent]     = useState(false)

  const chartLineRef    = useRef<SVGPathElement>(null)
  const chartAreaRef    = useRef<SVGPathElement>(null)
  const endDotRef       = useRef<SVGCircleElement>(null)
  const endRingRef      = useRef<SVGCircleElement>(null)
  const chartWrapRef    = useRef<HTMLDivElement>(null)
  const tooltipRef      = useRef<HTMLDivElement>(null)
  const connectorRef    = useRef<HTMLDivElement>(null)

  const { line: linePath, area: areaPath, last, tipLeft, tipTop } = buildChartPaths()

  /* Supabase auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setLoggedIn(!!s))
    return () => subscription.unsubscribe()
  }, [])

  /* Nav scroll darken */
  useEffect(() => {
    const nav = document.getElementById('l-nav')
    const handler = () => {
      if (nav) nav.style.background = window.scrollY > 60 ? 'rgba(2,8,23,.98)' : 'rgba(2,8,23,.8)'
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  /* Scroll reveal */
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target) } })
    }, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' })
    document.querySelectorAll('.landing .reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  /* CountUp */
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { countUp(e.target); obs.unobserve(e.target) } })
    }, { threshold: 0.5 })
    document.querySelectorAll('.landing .cu').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  /* Chart SVG animation */
  useEffect(() => {
    const line = chartLineRef.current
    const area = chartAreaRef.current
    const dot  = endDotRef.current
    const ring = endRingRef.current
    const tip  = tooltipRef.current
    const wrap = chartWrapRef.current
    if (!line || !area || !dot || !ring || !wrap) return

    area.setAttribute('d', areaPath)
    line.setAttribute('d', linePath)
    dot.setAttribute('cx',  String(last[0])); dot.setAttribute('cy',  String(last[1]))
    ring.setAttribute('cx', String(last[0])); ring.setAttribute('cy', String(last[1]))
    if (tip) { tip.style.left = tipLeft; tip.style.top = tipTop }

    const len = line.getTotalLength()
    line.style.strokeDasharray  = String(len)
    line.style.strokeDashoffset = String(len)
    line.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.4,0,.2,1)'

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) line.style.strokeDashoffset = '0'
    }, { threshold: 0.25 })
    obs.observe(wrap)
    return () => obs.disconnect()
  }, [areaPath, linePath, last, tipLeft, tipTop])

  /* Connector animation */
  useEffect(() => {
    const el = connectorRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) el.querySelector('.connector-line')?.classList.add('animate')
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  /* Widget rotation */
  useEffect(() => {
    const t = setInterval(() => {
      setWidgetOp(0)
      setTimeout(() => { setWidgetIdx(i => (i + 1) % PRODUCTS.length); setWidgetOp(1) }, 350)
    }, 4500)
    return () => clearInterval(t)
  }, [])

  const product = PRODUCTS[widgetIdx]
  const tickerDouble = [...TICKERS, ...TICKERS]

  /* Email submit */
  const handleEmail = (e: React.FormEvent) => {
    e.preventDefault()
    setEmailSent(true)
    setEmailVal('')
    setTimeout(() => setEmailSent(false), 3200)
  }

  return (
    <div className="landing">

      {/* ---- NAV ---- */}
      <nav id="l-nav">
        <div className="container">
          <div className="nav-inner">
            <a href="#hero" className="nav-logo">
              <div className="logo-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="3.5" stroke="white" strokeWidth="1.6"/>
                  <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1" strokeDasharray="2.5 2.5"/>
                  <path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              Price-A-Radar
            </a>
            <ul className="nav-links">
              <li><a href="#demo">Demo</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#how">Cómo funciona</a></li>
              <li><a href="#pricing">Precios</a></li>
            </ul>
            <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-primary" style={{padding:'10px 20px',fontSize:'14px'}}>
              {loggedIn ? 'Ir al dashboard' : 'Empezar gratis'}
            </Link>
          </div>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section id="hero">
        <div className="hero-glow"/>
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-eyebrow reveal">
                <span className="badge badge-green">
                  <span className="live-dot"/>
                  48.001 alertas activas ahora mismo
                </span>
              </div>
              <h1 className="hero-title reveal reveal-d1">
                El marketplace de<br/>los <span className="grad">mejores precios</span>
              </h1>
              <p className="hero-sub reveal reveal-d2">
                Monitoriza productos en tiempo real en +127 tiendas. Recibe alertas al instante y nunca pagues de más.
              </p>
              <div className="hero-ctas reveal reveal-d3">
                <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-primary">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5h11M8 3l5 4.5L8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {loggedIn ? 'Ir al dashboard' : 'Empezar gratis'}
                </Link>
                <a href="#demo" className="btn btn-secondary">Ver demo en vivo</a>
              </div>
            </div>

            <div className="hero-right reveal reveal-d2">
              <div className="price-widget">
                <div className="widget-head">
                  <span className="widget-prod" style={{opacity: widgetOpacity}}>{product.name}</span>
                  <div className="live-indicator"><span className="live-dot"/>En vivo</div>
                </div>
                <div className="store-list" style={{opacity: widgetOpacity}}>
                  {product.stores.map(s => (
                    <div key={s.name} className={`store-row${s.best ? ' best' : ''}`}>
                      <span className="store-lbl">{s.name}</span>
                      <div className="store-right">
                        <span className="store-price">€{s.price}</span>
                        {s.best && <span className="badge badge-green" style={{padding:'3px 10px',fontSize:'11px'}}>Mejor oferta</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ticker-wrap">
                  <div className="ticker-track">
                    {tickerDouble.map((t, i) => (
                      <div key={i} className="ticker-item">
                        📦 {t.name} <span className="drop">{t.drop} ({t.pct})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- SOCIAL PROOF ---- */}
      <section id="social">
        <div className="container">
          <div className="stats-grid">
            <div className="stat reveal">
              <span className="stat-num"><span className="euro">€</span><span className="cu" data-to="2.3" data-dec="1">0</span>M</span>
              <p className="stat-lbl">ahorrados por usuarios</p>
            </div>
            <div className="stat reveal reveal-d1">
              <span className="stat-num"><span className="cu" data-to="48" data-suf="K">0</span> alertas</span>
              <p className="stat-lbl">activas ahora mismo</p>
            </div>
            <div className="stat reveal reveal-d2">
              <span className="stat-num"><span className="cu" data-to="127">0</span> tiendas</span>
              <p className="stat-lbl">integradas y creciendo</p>
            </div>
            <div className="stat reveal reveal-d3">
              <span className="stat-num"><span className="cu" data-to="4.9" data-dec="1">0</span>★</span>
              <p className="stat-lbl">valoración media de usuarios</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- DEMO / CHART ---- */}
      <section id="demo">
        <div className="container">
          <div className="reveal">
            <span className="sec-tag badge badge-indigo">Demo en tiempo real</span>
            <h2 className="sec-title">Ve la evolución del precio<br/>antes de comprar</h2>
          </div>
          <div className="demo-grid">
            <div className="demo-info reveal reveal-d1">
              <p className="sec-sub" style={{maxWidth:'340px'}}>Historial completo de precios. Decide cuándo comprar con datos reales, no intuición.</p>
              <div className="demo-stat">
                <div className="demo-stat-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 8 12 12 14 19 7"/><polyline points="15 7 19 7 19 11"/></svg>
                </div>
                <div><div className="demo-stat-val">-24%</div><div className="demo-stat-txt">ahorro medio por alerta activada</div></div>
              </div>
              <div className="demo-stat" style={{marginTop:'14px'}}>
                <div className="demo-stat-icon">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="9"/><polyline points="11 6 11 11 14 13"/></svg>
                </div>
                <div><div className="demo-stat-val">&lt;60s</div><div className="demo-stat-txt">tiempo de entrega de la alerta</div></div>
              </div>
            </div>

            <div className="chart-box reveal reveal-d2">
              <div className="chart-topbar">
                <div>
                  <div className="chart-prod-name">PlayStation 5 Slim — Disco</div>
                  <div className="chart-prices">
                    <span className="chart-cur">€419</span>
                    <span className="chart-old">€549</span>
                    <span className="badge badge-green" style={{fontSize:'13px'}}>-24%</span>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <span className="badge badge-green" style={{marginBottom:'8px',display:'inline-flex'}}>Mínimo histórico</span>
                  <p style={{fontSize:'12px',color:'var(--c-muted)'}}>Actualizado hace 2 min</p>
                </div>
              </div>

              <div className="chart-svg-wrap" ref={chartWrapRef}>
                <svg className="chart-svg" viewBox="0 0 900 210" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#10b981" stopOpacity=".28"/>
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="52"  x2="900" y2="52"  stroke="#1e293b" strokeWidth="1" strokeDasharray="5 5"/>
                  <line x1="0" y1="105" x2="900" y2="105" stroke="#1e293b" strokeWidth="1" strokeDasharray="5 5"/>
                  <line x1="0" y1="158" x2="900" y2="158" stroke="#1e293b" strokeWidth="1" strokeDasharray="5 5"/>
                  <path ref={chartAreaRef} fill="url(#areaGrad)" opacity=".8"/>
                  <path ref={chartLineRef} fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle ref={endDotRef}  r="6" fill="#10b981"/>
                  <circle ref={endRingRef} r="6" fill="#10b981" opacity=".25">
                    <animate attributeName="r"       values="6;16;6"    dur="2.2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values=".25;0;.25" dur="2.2s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                <div className="tooltip-float" ref={tooltipRef}>¡Baja! −€130</div>
              </div>

              <div className="chart-labels">
                {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ahora'].map(m => <span key={m}>{m}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- FEATURES ---- */}
      <section id="features">
        <div className="container">
          <div className="features-head reveal">
            <span className="sec-tag badge badge-indigo">Funcionalidades</span>
            <h2 className="sec-title">Todo lo que necesitas para<br/>ahorrar sin esfuerzo</h2>
            <p className="sec-sub">Potente por dentro, simple por fuera. Configura tu primera alerta en segundos.</p>
          </div>
          <div className="feat-grid">

            <div className="feat-card reveal">
              <div className="feat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </div>
              <div className="feat-title">Alertas instantáneas</div>
              <div className="feat-desc">Recibe notificaciones por email o Telegram en el instante exacto que baja el precio al valor que fijaste.</div>
              <div className="feat-detail">→ Entrega confirmada en menos de 60 segundos del cambio.</div>
            </div>

            <div className="feat-card reveal reveal-d1">
              <div className="feat-icon" style={{background:'rgba(16,185,129,.1)',color:'var(--c-green)'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M6 10l4 4 8-8"/></svg>
              </div>
              <div className="feat-title">Comparador multi-tienda</div>
              <div className="feat-desc">Compara precios en Amazon, MediaMarkt, PcComponentes y +124 tiendas de un solo vistazo.</div>
              <div className="feat-detail">→ Ahorra hasta un 40% eligiendo la tienda más barata.</div>
            </div>

            <div className="feat-card reveal reveal-d2">
              <div className="feat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="feat-title">Historial de precios</div>
              <div className="feat-desc">Accede al historial completo con gráfica interactiva. Descubre el precio mínimo de todos los tiempos.</div>
              <div className="feat-detail">→ Datos históricos de hasta 2 años por producto.</div>
            </div>

            <div className="feat-card reveal reveal-d1">
              <div className="feat-icon" style={{background:'rgba(245,158,11,.1)',color:'#f59e0b'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="feat-title">Revisión programada</div>
              <div className="feat-desc">Configura con qué frecuencia revisamos el precio: cada hora, cada día o cada semana según tu plan.</div>
              <div className="feat-detail">→ Revisiones cada 15 minutos en plan Pro.</div>
            </div>

            <div className="feat-card reveal reveal-d2">
              <div className="feat-icon" style={{background:'rgba(6,182,212,.1)',color:'#06b6d4'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </div>
              <div className="feat-title">Comprobación manual</div>
              <div className="feat-desc">¿No puedes esperar? Lanza una revisión manual con un clic y obtén el precio actual al instante.</div>
              <div className="feat-detail">→ Sin límites de comprobaciones manuales en Pro.</div>
            </div>

            <div className="feat-card reveal reveal-d3">
              <div className="feat-icon" style={{background:'rgba(236,72,153,.1)',color:'#ec4899'}}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <div className="feat-title">Privado y seguro</div>
              <div className="feat-desc">Tus URLs y alertas son privadas. Nunca compartimos tus datos. Alojado en servidores europeos bajo el RGPD.</div>
              <div className="feat-detail">→ Cumplimiento total con RGPD · datos en la UE.</div>
            </div>

          </div>
        </div>
      </section>

      {/* ---- PRODUCTS ---- */}
      <section id="products">
        <div className="container">
          <div className="prods-head reveal">
            <span className="sec-tag badge badge-green">Detectados ahora</span>
            <h2 className="sec-title">Productos en mínimo histórico hoy</h2>
            <p className="sec-sub">Localizados en tiempo real por nuestro motor de rastreo.</p>
          </div>
          <div className="prods-grid">

            <div className="prod-card reveal">
              <div className="prod-img">
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <rect x="12" y="22" width="66" height="40" rx="4" fill="#1e3a5f" stroke="#6366f1" strokeWidth="1.5"/>
                  <rect x="20" y="29" width="50" height="26" rx="2" fill="#020817"/>
                  <rect x="24" y="62" width="42" height="5" rx="2" fill="#0a1628"/>
                  <path d="M25 42l10 8 12-14 10 10 12-16" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <span className="disc-badge">-31%</span>
              </div>
              <div className="prod-body">
                <div className="prod-store">Amazon</div>
                <div className="prod-name">MacBook Air M3 13" 8GB / 256GB Medianoche</div>
                <div className="prod-prices">
                  <span className="prod-cur">€999</span>
                  <span className="prod-old">€1.449</span>
                </div>
                <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-primary btn-prod">Ver oferta →</Link>
              </div>
            </div>

            <div className="prod-card reveal reveal-d1">
              <div className="prod-img">
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <rect x="28" y="12" width="34" height="66" rx="7" fill="#1e3a5f" stroke="#6366f1" strokeWidth="1.5"/>
                  <rect x="34" y="20" width="22" height="42" rx="2" fill="#020817"/>
                  <circle cx="45" cy="70" r="2.5" fill="#6366f1"/>
                  <rect x="39" y="14" width="12" height="3" rx="1.5" fill="#0a1628"/>
                  <circle cx="45" cy="41" r="9" stroke="#10b981" strokeWidth="1.5" fill="none"/>
                  <path d="M41 41l3 3 6-6" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="disc-badge">-22%</span>
              </div>
              <div className="prod-body">
                <div className="prod-store">MediaMarkt</div>
                <div className="prod-name">iPhone 16 128 GB — Negro</div>
                <div className="prod-prices">
                  <span className="prod-cur">€699</span>
                  <span className="prod-old">€899</span>
                </div>
                <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-primary btn-prod">Ver oferta →</Link>
              </div>
            </div>

            <div className="prod-card reveal reveal-d2">
              <div className="prod-img">
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <path d="M22 50V44a23 23 0 0146 0v6" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round"/>
                  <rect x="16" y="48" width="14" height="22" rx="5" fill="#1e3a5f" stroke="#6366f1" strokeWidth="1.5"/>
                  <rect x="60" y="48" width="14" height="22" rx="5" fill="#1e3a5f" stroke="#6366f1" strokeWidth="1.5"/>
                  <circle cx="23" cy="59" r="4" fill="#10b981" opacity=".6"/>
                  <circle cx="67" cy="59" r="4" fill="#10b981" opacity=".6"/>
                </svg>
                <span className="disc-badge">-38%</span>
              </div>
              <div className="prod-body">
                <div className="prod-store">PcComponentes</div>
                <div className="prod-name">Sony WH-1000XM5 Auriculares BT</div>
                <div className="prod-prices">
                  <span className="prod-cur">€219</span>
                  <span className="prod-old">€349</span>
                </div>
                <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-primary btn-prod">Ver oferta →</Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section id="how">
        <div className="container">
          <div className="how-head reveal">
            <span className="sec-tag badge badge-indigo">Simple y rápido</span>
            <h2 className="sec-title">Empieza a ahorrar en 3 pasos</h2>
            <p className="sec-sub">Configura tu primera alerta en menos de 60 segundos. Sin tarjeta. Sin complicaciones.</p>
          </div>
          <div className="steps-wrap">
            <div className="connector" ref={connectorRef}>
              <div className="connector-dot left"/>
              <div className="connector-line"/>
              <div className="connector-dot right"/>
            </div>
            <div className="steps-grid">
              <div className="step reveal">
                <div className="step-circle"><span className="step-num">1</span></div>
                <h3 className="step-title">Pega la URL</h3>
                <p className="step-desc">Copia la URL de cualquier producto desde Amazon, MediaMarkt, PcComponentes o +124 tiendas.</p>
                <span className="step-pill">→ Un solo pegado</span>
              </div>
              <div className="step reveal reveal-d1">
                <div className="step-circle" style={{borderColor:'#334155'}}><span className="step-num" style={{color:'var(--c-muted)'}}>2</span></div>
                <h3 className="step-title">Fija tu precio</h3>
                <p className="step-desc">Indica el precio al que quieres comprar. Nuestro sistema vigila el producto de forma continua.</p>
                <span className="step-pill" style={{background:'rgba(16,185,129,.08)',color:'var(--c-green)',borderColor:'rgba(16,185,129,.2)'}}>↓ Precio objetivo</span>
              </div>
              <div className="step reveal reveal-d2">
                <div className="step-circle" style={{borderColor:'var(--c-green)'}}><span className="step-num">3</span></div>
                <h3 className="step-title">Recibe la alerta</h3>
                <p className="step-desc">Te avisamos por email o Telegram en el instante que el precio baje a tu objetivo.</p>
                <span className="step-pill" style={{background:'rgba(16,185,129,.08)',color:'var(--c-green)',borderColor:'rgba(16,185,129,.2)'}}>🔔 Alerta en &lt;60s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- PRICING ---- */}
      <section id="pricing">
        <div className="container">
          <div className="pricing-head reveal">
            <span className="sec-tag badge badge-indigo">Precios</span>
            <h2 className="sec-title">Simple y sin sorpresas</h2>
            <p className="sec-sub">Empieza gratis, escala cuando lo necesites. Sin permanencia.</p>
          </div>
          <div className="pricing-grid">

            <div className="plan-card reveal">
              <div className="plan-tier">Gratis</div>
              <div className="plan-price-row"><span className="plan-amount">0</span><span className="plan-period">€/mes</span></div>
              <p className="plan-desc">Perfecto para empezar a ahorrar sin comprometerte con nada.</p>
              <ul className="plan-feats">
                <li><IconCheck/>3 alertas activas</li>
                <li><IconCheck/>Revisión cada 24 horas</li>
                <li><IconCheck/>Alertas por email</li>
                <li><IconCheck/>10 créditos de comprobación</li>
                <li className="off"><IconCross/>Historial extendido (2 años)</li>
                <li className="off"><IconCross/>Alertas por Telegram</li>
                <li className="off"><IconCross/>Comparador multi-tienda avanzado</li>
              </ul>
              <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-secondary btn-plan">Empezar gratis</Link>
            </div>

            <div className="plan-card featured reveal reveal-d1">
              <div className="pop-badge">⚡ Más popular</div>
              <div className="plan-tier">Pro</div>
              <div className="plan-price-row">
                <span className="plan-currency">€</span>
                <span className="plan-amount">4,99</span>
                <span className="plan-period">/mes</span>
              </div>
              <p className="plan-desc">Para compradores habituales que quieren el máximo ahorro sin límites.</p>
              <ul className="plan-feats">
                <li><IconCheck/>Alertas ilimitadas</li>
                <li><IconCheck/>Revisión cada 15 minutos</li>
                <li><IconCheck/>Email + Telegram</li>
                <li><IconCheck/>Historial completo (2 años)</li>
                <li><IconCheck/>Comparador multi-tienda avanzado</li>
                <li><IconCheck/>Comprobaciones manuales ilimitadas</li>
                <li><IconCheck/>Soporte prioritario</li>
              </ul>
              <Link to={loggedIn ? '/dashboard' : '/login'} className="btn btn-primary btn-plan">Empezar con Pro →</Link>
            </div>

          </div>
        </div>
      </section>

      {/* ---- CTA ---- */}
      <section id="cta">
        <div className="container">
          <div className="cta-inner reveal">
            <span className="sec-tag badge badge-indigo" style={{marginBottom:'22px'}}>Únete ahora · Es gratis</span>
            <h2 className="cta-title">
              Para de pagar de más.<br/>
              <span style={{color:'var(--c-green)'}}>Para siempre.</span>
            </h2>
            <p className="cta-sub">Más de 48.000 usuarios ya usan Price-A-Radar para comprar más inteligente en España.</p>
            <form className="email-form" onSubmit={handleEmail}>
              <input
                type="email"
                className="email-input"
                placeholder="tu@email.com"
                value={emailVal}
                onChange={e => setEmailVal(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={emailSent ? {background:'var(--c-green)'} : {}}
              >
                {emailSent ? '✓ ¡Registrado!' : 'Empezar gratis →'}
              </button>
            </form>
            <p className="fine-print">
              <b>Sin tarjeta de crédito</b> &nbsp;·&nbsp; <b>10 créditos gratis</b> &nbsp;·&nbsp; <b>Cancela cuando quieras</b>
            </p>
          </div>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer>
        <div className="container">
          <div className="foot-inner">
            <a href="#hero" className="nav-logo" style={{fontSize:'17px'}}>
              <div className="logo-icon" style={{width:'30px',height:'30px'}}>
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="3.5" stroke="white" strokeWidth="1.6"/>
                  <circle cx="10" cy="10" r="7" stroke="white" strokeWidth="1" strokeDasharray="2.5 2.5"/>
                </svg>
              </div>
              Price-A-Radar
            </a>
            <ul className="foot-links">
              <li><a href="#">Privacidad</a></li>
              <li><a href="#">Términos</a></li>
              <li><a href="#">Cookies</a></li>
              <li><a href="#">Contacto</a></li>
            </ul>
            <p className="foot-copy">© {new Date().getFullYear()} Price-A-Radar &nbsp;·&nbsp; Hecho con ☕ en España</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
