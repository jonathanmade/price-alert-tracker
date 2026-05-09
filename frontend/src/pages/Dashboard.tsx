export default function Dashboard() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mis alertas</h1>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nueva alerta
        </button>
      </div>
      <p className="text-gray-400 text-sm">Próximamente: lista de alertas activas.</p>
    </div>
  )
}
