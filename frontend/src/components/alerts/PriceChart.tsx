import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import type { PriceHistory } from '../../api/types'

interface Props {
  history: PriceHistory[]
  targetPrice: number
}

const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const formatPrice = (v: number) => `${v.toFixed(2)} €`

export default function PriceChart({ history, targetPrice }: Props) {
  if (history.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400">
        Sin datos de historial todavía.
      </div>
    )
  }

  const data = history.map(h => ({
    date: formatDate(h.checked_at),
    price: Number(h.price),
  }))

  const prices = data.map(d => d.price)
  const minY = Math.min(...prices, targetPrice) * 0.95
  const maxY = Math.max(...prices, targetPrice) * 1.05

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[minY, maxY]}
          tickFormatter={formatPrice}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(2)} €`, 'Precio']}
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
        />
        <ReferenceLine
          y={targetPrice}
          stroke="#4F46E5"
          strokeDasharray="4 4"
          label={{ value: 'Objetivo', position: 'insideTopRight', fontSize: 10, fill: '#4F46E5' }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke="#4F46E5"
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#4F46E5' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
