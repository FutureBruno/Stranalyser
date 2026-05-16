import { useState, useEffect } from 'react'
import { settingsApi } from '../api/client'

const PROVIDER_META = {
  anthropic: {
    label: 'Anthropic (Claude)',
    keyLabel: 'Anthropic API-Key',
    keyPlaceholder: 'sk-ant-…',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    label: 'Google (Gemini)',
    keyLabel: 'Google API-Key',
    keyPlaceholder: 'AIza…',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
}

const MASK = '••••••••'

function KeyField({ label, placeholder, value, hasKey, onChange, onClear }) {
  const [editing, setEditing] = useState(false)

  const handleFocus = () => {
    if (!editing) {
      setEditing(true)
      onChange('')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type={editing ? 'text' : 'password'}
          value={editing ? value : (hasKey ? MASK : value)}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-strava-orange font-mono"
        />
        {hasKey && !editing && (
          <button
            type="button"
            onClick={() => { setEditing(true); onChange('') }}
            className="text-xs px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600"
          >
            Ändern
          </button>
        )}
        {hasKey && (
          <button
            type="button"
            onClick={() => { setEditing(false); onClear() }}
            className="text-xs px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-600"
          >
            Löschen
          </button>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const [anthropicKey, setAnthropicKey] = useState('')
  const [googleKey, setGoogleKey] = useState('')
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [hasGoogleKey, setHasGoogleKey] = useState(false)
  const [preferredProvider, setPreferredProvider] = useState('')
  const [preferredModel, setPreferredModel] = useState('')
  const [availableProviders, setAvailableProviders] = useState({})

  useEffect(() => {
    settingsApi.get()
      .then(({ data }) => {
        setHasAnthropicKey(data.has_anthropic_key)
        setHasGoogleKey(data.has_google_key)
        setPreferredProvider(data.preferred_provider || '')
        setPreferredModel(data.preferred_model || '')
        setAvailableProviders(data.available_providers || {})
      })
      .catch(() => setError('Einstellungen konnten nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [])

  const handleProviderChange = (provider) => {
    setPreferredProvider(provider)
    setPreferredModel('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload = {
        preferred_provider: preferredProvider || null,
        preferred_model: preferredModel || null,
      }
      if (anthropicKey !== '' && anthropicKey !== MASK) {
        payload.anthropic_api_key = anthropicKey
      }
      if (googleKey !== '' && googleKey !== MASK) {
        payload.google_api_key = googleKey
      }
      const { data } = await settingsApi.update(payload)
      setHasAnthropicKey(data.has_anthropic_key)
      setHasGoogleKey(data.has_google_key)
      setAnthropicKey('')
      setGoogleKey('')
      setSaved(true)
      // Modelle neu laden (Keys könnten sich geändert haben)
      const { data: fresh } = await settingsApi.get()
      setAvailableProviders(fresh.available_providers || {})
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Speichern fehlgeschlagen. Bitte versuche es erneut.')
    } finally {
      setSaving(false)
    }
  }

  const handleClearKey = async (provider) => {
    try {
      const payload = provider === 'anthropic'
        ? { anthropic_api_key: '' }
        : { google_api_key: '' }
      await settingsApi.update(payload)
      if (provider === 'anthropic') {
        setHasAnthropicKey(false)
        setAnthropicKey('')
      } else {
        setHasGoogleKey(false)
        setGoogleKey('')
      }
      const { data: fresh } = await settingsApi.get()
      setAvailableProviders(fresh.available_providers || {})
    } catch {
      setError('Löschen fehlgeschlagen.')
    }
  }

  const availableModels = preferredProvider
    ? (availableProviders[preferredProvider]?.models ?? [])
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strava-orange" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Einstellungen</h1>

      <form onSubmit={handleSave} className="space-y-8">
        {/* AI Provider & Keys */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900">KI-Konfiguration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Eigene API-Keys für Anthropic und/oder Google hinterlegen.
              Keys werden sicher in deinem Account gespeichert.
            </p>
          </div>

          {Object.entries(PROVIDER_META).map(([key, meta], i) => (
            <div key={key}>
              {i > 0 && <hr className="border-gray-100 mb-6" />}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{meta.label}</span>
                  <a
                    href={meta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-strava-orange hover:underline"
                  >
                    API-Key erstellen ↗
                  </a>
                </div>
                <KeyField
                  label={meta.keyLabel}
                  placeholder={meta.keyPlaceholder}
                  value={key === 'anthropic' ? anthropicKey : googleKey}
                  hasKey={key === 'anthropic' ? hasAnthropicKey : hasGoogleKey}
                  onChange={key === 'anthropic' ? setAnthropicKey : setGoogleKey}
                  onClear={() => handleClearKey(key)}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Default Provider & Model */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Standard-Modell</h2>
            <p className="text-sm text-gray-500 mt-1">
              Voreinstellung für KI-Analysen. Kann pro Anfrage im Analyse-Dialog überschrieben werden.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Anbieter</label>
            <div className="flex gap-3">
              {Object.entries(PROVIDER_META).map(([key, { label }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleProviderChange(key)}
                  className={`flex-1 text-sm px-4 py-2.5 rounded-lg border transition-colors ${
                    preferredProvider === key
                      ? 'border-strava-orange bg-orange-50 text-strava-orange font-medium'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
              {preferredProvider && (
                <button
                  type="button"
                  onClick={() => { setPreferredProvider(''); setPreferredModel('') }}
                  className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
          </div>

          {preferredProvider && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modell
                {availableModels.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    ({availableModels.length} verfügbar)
                  </span>
                )}
              </label>
              {availableModels.length > 0 ? (
                <select
                  value={preferredModel}
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-strava-orange bg-white"
                >
                  <option value="">— Standardmodell des Anbieters —</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-gray-400">
                  Kein API-Key hinterlegt — Modelle werden nach dem Speichern geladen.
                </p>
              )}
            </div>
          )}
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-strava-orange text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Wird gespeichert…' : 'Speichern'}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Einstellungen gespeichert.</span>
          )}
        </div>
      </form>
    </div>
  )
}
