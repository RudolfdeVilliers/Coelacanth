export default function SentimentBar({ sentiment }) {
  if (!sentiment) return null

  const { positive_pct = 0, neutral_pct = 0, frustrated_pct = 0 } = sentiment

  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-2">Sentiment breakdown</p>
      <div className="flex rounded-full overflow-hidden h-4 w-full">
        {positive_pct > 0 && (
          <div
            style={{ width: `${positive_pct}%` }}
            className="bg-green-400 transition-all"
            title={`Positive: ${positive_pct}%`}
          />
        )}
        {neutral_pct > 0 && (
          <div
            style={{ width: `${neutral_pct}%` }}
            className="bg-gray-300 transition-all"
            title={`Neutral: ${neutral_pct}%`}
          />
        )}
        {frustrated_pct > 0 && (
          <div
            style={{ width: `${frustrated_pct}%` }}
            className="bg-red-400 transition-all"
            title={`Frustrated: ${frustrated_pct}%`}
          />
        )}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Positive {positive_pct}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
          Neutral {neutral_pct}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          Frustrated {frustrated_pct}%
        </span>
      </div>
    </div>
  )
}
