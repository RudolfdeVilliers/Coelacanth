'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function WeeklyChart({ digests }) {
  if (!digests || digests.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No trend data yet
      </div>
    )
  }

  const data = [...digests]
    .reverse()
    .map(d => ({
      week: d.week_of,
      submissions: d.total_submissions,
    }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          labelStyle={{ color: '#374151', fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="submissions"
          stroke="#F7FE4F"
          strokeWidth={2.5}
          dot={{ fill: '#F7FE4F', strokeWidth: 2, stroke: '#d4db00', r: 4 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
