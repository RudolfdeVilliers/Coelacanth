export default function MetricCard({ label, value, accent = false }) {
  return (
    <div className={`rounded-xl p-5 border ${accent ? 'bg-[#F7FE4F] border-[#e8ef00]' : 'bg-white border-gray-200'}`}>
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
