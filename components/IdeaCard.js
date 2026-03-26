export default function IdeaCard({ theme, count, example, type = 'issue' }) {
  const accent = type === 'opportunity' ? 'border-[#F7FE4F] bg-[#fffff0]' : 'border-gray-200 bg-white'

  return (
    <div className={`rounded-xl border p-4 ${accent}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-gray-900 text-sm leading-snug">{theme}</p>
        <span className="text-xs font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 whitespace-nowrap">
          {count} {count === 1 ? 'mention' : 'mentions'}
        </span>
      </div>
      {example && (
        <p className="text-sm text-gray-500 italic leading-relaxed">"{example}"</p>
      )}
    </div>
  )
}
