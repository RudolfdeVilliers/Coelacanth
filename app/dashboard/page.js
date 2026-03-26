'use client'

import { useState, useEffect } from 'react'
import MetricCard from '@/components/MetricCard'
import SentimentBar from '@/components/SentimentBar'
import IdeaCard from '@/components/IdeaCard'
import WeeklyChart from '@/components/WeeklyChart'

const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || 'demo'

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('coelacanth_auth')
    if (token) {
      setAuthed(true)
    }
  }, [])

  useEffect(() => {
    if (authed) fetchData()
  }, [authed])

  async function handleLogin(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Login failed')
      localStorage.setItem('coelacanth_auth', json.token)
      setAuthed(true)
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function fetchData() {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('coelacanth_auth')
      const res = await fetch(`/api/insights?orgSlug=${ORG_SLUG}&weeks=4`, {
        headers: { Authorization: token },
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('coelacanth_auth')
          setAuthed(false)
          return
        }
        throw new Error(json.error || 'Failed to load data')
      }
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('coelacanth_auth')
    setAuthed(false)
    setData(null)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-5 h-5 bg-[#F7FE4F] rounded-full" />
            <span className="text-xl font-bold">Coelacanth</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <h1 className="text-xl font-bold mb-1">Admin dashboard</h1>
            <p className="text-gray-500 text-sm mb-6">Enter your password to continue</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#F7FE4F] focus:ring-2 focus:ring-[#F7FE4F]/30"
                autoFocus
              />
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#F7FE4F] text-gray-900 font-semibold py-3 rounded-lg hover:bg-[#e8ef00] transition-colors disabled:opacity-60"
              >
                {authLoading ? 'Checking...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#F7FE4F] rounded-full" />
            <span className="font-bold text-lg">Coelacanth</span>
            {data && (
              <span className="text-gray-400 text-sm ml-2">{data.org.name}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl bg-gray-200 animate-pulse h-24" />
              ))}
            </>
          ) : data ? (
            <>
              <MetricCard label="This week" value={data.thisWeek.total} accent />
              <MetricCard
                label="Operations"
                value={data.thisWeek.byCategory.operations}
              />
              <MetricCard
                label="Culture"
                value={data.thisWeek.byCategory.culture}
              />
              <MetricCard
                label="Product"
                value={data.thisWeek.byCategory.product}
              />
            </>
          ) : null}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Top issues + opportunities */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Top Issues</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : data?.latestDigest?.insights?.top_issues?.length > 0 ? (
              <div className="space-y-3">
                {data.latestDigest.insights.top_issues.map((issue, i) => (
                  <IdeaCard key={i} {...issue} type="issue" />
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No digest available yet</p>
            )}

            {data?.latestDigest?.insights?.top_opportunities?.length > 0 && (
              <>
                <h2 className="font-semibold text-gray-800 pt-2">Opportunities</h2>
                <div className="space-y-3">
                  {data.latestDigest.insights.top_opportunities.map((opp, i) => (
                    <IdeaCard key={i} {...opp} type="opportunity" />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right column: sentiment + trend + AI insight */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Sentiment</h2>
              {loading ? (
                <div className="h-8 bg-gray-100 animate-pulse rounded-full" />
              ) : data?.latestDigest?.insights?.sentiment ? (
                <SentimentBar sentiment={data.latestDigest.insights.sentiment} />
              ) : (
                <p className="text-gray-400 text-sm">No data yet</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Submissions trend</h2>
              {loading ? (
                <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
              ) : (
                <WeeklyChart digests={data?.recentDigests} />
              )}
            </div>

            {data?.latestDigest?.insights?.ai_insight && (
              <div className="bg-[#fffff0] border border-[#e8ef00] rounded-2xl p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  AI Insight
                </p>
                <p className="text-sm italic text-gray-700 leading-relaxed">
                  {data.latestDigest.insights.ai_insight}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick wins */}
        {data?.latestDigest?.insights?.quick_wins?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Quick Wins</h2>
            <div className="space-y-2">
              {data.latestDigest.insights.quick_wins.map((win, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-5 h-5 bg-[#F7FE4F] rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="text-gray-700 pt-0.5">{win}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw feed */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Recent submissions</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : data?.rawFeed?.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data.rawFeed.map((idea, i) => (
                <div key={i} className="py-3 flex items-start gap-3">
                  {idea.category && (
                    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 mt-0.5 whitespace-nowrap">
                      {idea.category}
                    </span>
                  )}
                  <p className="text-sm text-gray-700 flex-1">{idea.body}</p>
                  <time className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                    {new Date(idea.submitted_at).toLocaleDateString()}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No submissions yet</p>
          )}
        </div>
      </main>
    </div>
  )
}
