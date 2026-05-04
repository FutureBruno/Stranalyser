import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

export default function LoginPage() {
  const { athlete, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && athlete) {
      navigate('/', { replace: true })
    }
  }, [athlete, loading, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold text-strava-orange mb-2">Stranalyser</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Deine Strava-Aktivitäten lokal analysieren
        </p>

        <a
          href="/api/auth/login"
          className="inline-flex items-center gap-3 bg-strava-orange text-white px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition-colors shadow"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Mit Strava verbinden
        </a>

        <p className="mt-6 text-xs text-gray-400">
          Deine Daten bleiben lokal auf deinem Gerät.
        </p>
      </div>
    </div>
  )
}
