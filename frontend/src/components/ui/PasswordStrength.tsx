import { useMemo } from 'react'

interface Rule { label: string; test: (p: string) => boolean }

const rules: Rule[] = [
  { label: 'Mínimo 8 caracteres',    test: p => p.length >= 8 },
  { label: 'Una letra mayúscula',     test: p => /[A-Z]/.test(p) },
  { label: 'Un carácter especial',    test: p => /[^A-Za-z0-9]/.test(p) },
]

export function validatePassword(password: string): boolean {
  return rules.every(r => r.test(password))
}

export default function PasswordStrength({ password }: { password: string }) {
  const results = useMemo(() => rules.map(r => ({ ...r, ok: r.test(password) })), [password])
  if (!password) return null
  return (
    <ul className="mt-2 space-y-1">
      {results.map(r => (
        <li key={r.label} className={`flex items-center gap-2 text-xs transition-colors
          ${r.ok ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
            ${r.ok ? 'bg-emerald-400' : 'bg-slate-600'}`}/>
          {r.label}
        </li>
      ))}
    </ul>
  )
}
