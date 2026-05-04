import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/Layout/Layout'
import LoginPage from './pages/LoginPage'
import ActivitiesPage from './pages/ActivitiesPage'
import ActivityPage from './pages/ActivityPage'
import DashboardPage from './pages/DashboardPage'

function ProtectedRoute({ children }) {
  const { athlete, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-strava-orange" />
      </div>
    )
  }

  if (!athlete) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="activities" element={<ActivitiesPage />} />
          <Route path="activities/:id" element={<ActivityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
