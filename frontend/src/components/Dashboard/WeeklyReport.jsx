import { useState, useEffect } from 'react'
import { aiApi } from '../../api/client'

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      {children}
    </div>
  )
}

function BulletList({ items, color = 'text-strava-orange' }) {
  if (!items?.length) return null
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-600">
          <span className={`${color} mt-0.5 flex-shrink-0`}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

const WEEK_OPTIONS = [
  { label: 'Diese Woche', offset: 0 },
  { label: 'Letzte Woche', offset: -1 },
  { label: 'Vor 2 Wochen', offset: -2 },
]

export default function WeeklyReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setReport(null)
      setError(null)
      try {
        const { data } = await aiApi.getWeeklyReport()
        setReport(data)
      } catch {
        // No report yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const generate = async (forceRefresh = false) => {
    setGenerating(true)
    setError(null)
    try {
      const { data } = await aiApi.generateWeeklyReport({
        week_offset: weekOffset,
        force_refresh: forceRefresh,
      })
      setReport(data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Bericht konnte nicht erstellt werden.'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const content = report?.content

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-gray-100 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-gray-800">KI-Wochenbericht</h3>
          {content?.woche && (
            <span className="text-xs text-gray-400">{content.woche}</span>
          )}
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {report && (
            <button
              onClick={() => generate(true)}
              disabled={generating}
              className="text-xs text-gray-500 hover:text-strava-orange transition-colors disabled:opacity-50"
            >
              {generating ? 'Wird erstellt…' : 'Neu erstellen'}
            </button>
          )}
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div>
          {/* Week selector + generate button (when no report) */}
          {!report && !loading && (
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {WEEK_OPTIONS.map((opt) => (
                  <button
                    key={opt.offset}
                    onClick={() => setWeekOffset(opt.offset)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      weekOffset === opt.offset
                        ? 'bg-strava-orange text-white border-strava-orange'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-strava-orange hover:text-strava-orange'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => generate(false)}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-strava-orange text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Claude analysiert…
                  </>
                ) : (
                  <>✨ Wochenbericht erstellen</>
                )}
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-strava-orange" />
            </div>
          )}

          {/* Generating */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strava-orange" />
              <p className="text-sm">Claude analysiert deine Trainingswoche…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 my-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Report content */}
          {content && !generating && (
            <div className="p-4 space-y-5">
              {/* Zusammenfassung */}
              {content.zusammenfassung && (
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg text-sm text-gray-700 leading-relaxed">
                  {content.zusammenfassung}
                </div>
              )}

              {/* Sportarten-Übersicht */}
              {content.sportarten_uebersicht?.length > 0 && (
                <Section title="📋 Diese Woche">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {content.sportarten_uebersicht.map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        <p className="font-medium text-sm">{s.sport}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.anzahl}× · {s.gesamt_distanz}</p>
                        <p className="text-xs text-gray-400">{s.gesamt_dauer}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Highlights */}
              {content.highlights?.length > 0 && (
                <Section title="⭐ Highlights">
                  <BulletList items={content.highlights} />
                </Section>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Verbesserungen */}
                {content.verbesserungen?.length > 0 && (
                  <Section title="📈 Was hat sich verbessert?">
                    <BulletList items={content.verbesserungen} color="text-green-500" />
                  </Section>
                )}

                {/* Worauf achten */}
                {content.worauf_achten?.length > 0 && (
                  <Section title="👁 Worauf achten?">
                    <BulletList items={content.worauf_achten} color="text-amber-500" />
                  </Section>
                )}
              </div>

              {/* Empfehlungen */}
              {content.empfehlungen?.length > 0 && (
                <Section title="🎯 Empfehlungen">
                  <BulletList items={content.empfehlungen} />
                </Section>
              )}

              {/* Erholung & Belastung */}
              {content.erholung_und_belastung && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-700">
                  <span className="font-medium">🛌 Belastung & Erholung: </span>
                  {content.erholung_und_belastung}
                </div>
              )}

              {/* Nächste Woche */}
              {content.naechste_woche && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-gray-700">
                  <span className="font-medium">📅 Nächste Woche: </span>
                  {content.naechste_woche}
                </div>
              )}

              {/* Rohdaten-Fallback */}
              {content.raw && (
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 whitespace-pre-wrap font-mono">
                  {content.raw}
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-gray-300 pt-1">
                <span>
                  {report.created_at && `Erstellt: ${new Date(report.created_at).toLocaleString('de-DE')}`}
                </span>
                {report.model && (
                  <span>{report.model} · {(report.input_tokens || 0) + (report.output_tokens || 0)} Tokens</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
