import { useState, useEffect } from 'react'
import { aiApi } from '../../api/client'

const PROVIDER_LABELS = { anthropic: 'Anthropic (Claude)', google: 'Google (Gemini)' }

export default function ModelSelector({ value, onChange }) {
  const [providers, setProviders] = useState(null)

  useEffect(() => {
    aiApi.getProviders()
      .then(({ data }) => {
        setProviders(data)
        if (!value) {
          for (const [pName, pInfo] of Object.entries(data.providers)) {
            if (pInfo.configured && pInfo.models.includes(data.current_model)) {
              onChange(data.current_model, pName)
              break
            }
          }
        }
      })
      .catch(() => {})
  }, [])

  if (!providers) return null

  const configuredProviders = Object.entries(providers.providers).filter(([, p]) => p.configured)
  if (!configuredProviders.length) return null

  const handleChange = (e) => {
    const model = e.target.value
    for (const [pName, pInfo] of Object.entries(providers.providers)) {
      if (pInfo.models.includes(model)) {
        onChange(model, pName)
        return
      }
    }
  }

  return (
    <select
      value={value || providers.current_model}
      onChange={handleChange}
      title="KI-Modell auswählen"
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white hover:border-gray-300 focus:outline-none focus:border-strava-orange cursor-pointer"
    >
      {configuredProviders.map(([pName, pInfo]) => (
        <optgroup key={pName} label={PROVIDER_LABELS[pName] || pName}>
          {pInfo.models.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
