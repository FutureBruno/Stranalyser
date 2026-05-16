import { useState, useEffect } from 'react'
import { aiApi } from '../../api/client'
import ModelSelector from '../AI/ModelSelector'

function TrendBadge({ text }) {
  if (!text) return null
  const lower = text.toLowerCase()
  const isBetter = lower.startsWith('besser')
  const isWorse = lower.startsWith('schlechter')
  const color = isBetter
    ? 'bg-green-100 text-green-800'
    : isWorse
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-700'
  const icon = isBetter ? '↑' : isWorse ? '↓' : '→'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {icon} {text}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      {children}
    </div>
  )
}

function BulletList({ items }) {
  if (!items?.length) return null
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-600">
          <span className="text-strava-orange mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AIAnalysis({ activityId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await aiApi.getActivityAnalysis(activityId)
        setAnalysis(data)
      } catch {
        // No analysis yet – that's fine
      } finally {
        setLoading(false)
      }
    }
    if (activityId) load()
  }, [activityId])

  const generate = async (forceRefresh = false) => {
    setGenerating(true)
    setError(null)
    try {
      const params = { force_refresh: forceRefresh }
      if (selectedModel) params.model = selectedModel
      if (selectedProvider) params.provider = selectedProvider
      const { data } = await aiApi.analyzeActivity(activityId, params)
      setAnalysis(data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Analyse fehlgeschlagen.'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const content = analysis?.content

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-gray-800">KI-Aktivitätsanalyse</h3>
          {analysis && (
            <span className="text-xs text-gray-400">
              {new Date(analysis.created_at).toLocaleDateString('de-DE')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModelSelector
            value={selectedModel}
            onChange={(m, p) => { setSelectedModel(m); setSelectedProvider(p) }}
          />
          {analysis && (
            <button
              onClick={() => generate(true)}
              disabled={generating}
              className="text-xs text-gray-500 hover:text-strava-orange transition-colors disabled:opacity-50"
            >
              {generating ? 'Wird analysiert…' : 'Neu analysieren'}
            </button>
          )}
          {!analysis && !loading && (
            <button
              onClick={() => generate(false)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-strava-orange text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Wird analysiert…
                </>
              ) : (
                <>✨ Aktivität analysieren</>
              )}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-strava-orange" />
        </div>
      )}

      {generating && !content && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strava-orange" />
          <p className="text-sm">
            {selectedModel ? `${selectedModel} analysiert…` : 'KI analysiert deine Aktivität…'}
          </p>
        </div>
      )}

      {error && (
        <div className="mx-4 my-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !generating && !analysis && !error && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
          <span className="text-3xl">🤖</span>
          <p className="text-sm">Lass die KI diese Aktivität analysieren und mit deinen letzten Trainings vergleichen.</p>
        </div>
      )}

      {content && !generating && (
        <div className="p-4 space-y-5">
          {content.bewertung && (
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm text-gray-700 leading-relaxed">
              {content.bewertung}
            </div>
          )}

          {content.leistungsvergleich && (
            <Section title="📊 Leistungsvergleich">
              <div className="space-y-2">
                {content.leistungsvergleich.tempo_trend && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-500">Tempo</span>
                    <TrendBadge text={content.leistungsvergleich.tempo_trend} />
                  </div>
                )}
                {content.leistungsvergleich.herzfrequenz_trend && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-500">Herzfrequenz</span>
                    <TrendBadge text={content.leistungsvergleich.herzfrequenz_trend} />
                  </div>
                )}
                {content.leistungsvergleich.ausdauer_trend && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-500">Ausdauer</span>
                    <TrendBadge text={content.leistungsvergleich.ausdauer_trend} />
                  </div>
                )}
                {content.leistungsvergleich.zusammenfassung && (
                  <p className="text-sm text-gray-600 mt-2">{content.leistungsvergleich.zusammenfassung}</p>
                )}
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {content.staerken?.length > 0 && (
              <Section title="💪 Stärken">
                <BulletList items={content.staerken} />
              </Section>
            )}
            {content.verbesserungspotential?.length > 0 && (
              <Section title="📈 Verbesserungspotenzial">
                <BulletList items={content.verbesserungspotential} />
              </Section>
            )}
          </div>

          {content.besonderheiten && content.besonderheiten !== 'null' && (
            <Section title="⚡ Besonderheiten">
              <p className="text-sm text-gray-600">{content.besonderheiten}</p>
            </Section>
          )}

          {content.trainingsempfehlungen?.length > 0 && (
            <Section title="🎯 Empfehlungen fürs nächste Training">
              <BulletList items={content.trainingsempfehlungen} />
            </Section>
          )}

          {content.erholung && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-700">
              <span className="font-medium">🛌 Erholung: </span>{content.erholung}
            </div>
          )}

          {content.raw && (
            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 whitespace-pre-wrap font-mono">
              {content.raw}
            </div>
          )}

          {analysis.model && (
            <p className="text-right text-xs text-gray-300">
              {analysis.model} · {analysis.input_tokens + analysis.output_tokens} Tokens
            </p>
          )}
        </div>
      )}
    </div>
  )
}
