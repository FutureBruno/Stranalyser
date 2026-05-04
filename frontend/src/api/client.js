import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

export const activitiesApi = {
  list: (params) => api.get('/activities', { params }),
  get: (id) => api.get(`/activities/${id}`),
  streams: (id) => api.get(`/activities/${id}/streams`),
}

export const syncApi = {
  trigger: () => api.post('/sync/trigger'),
  status: () => api.get('/sync/status'),
}

export const statsApi = {
  overview: () => api.get('/stats/overview'),
  weekly: (params) => api.get('/stats/weekly', { params }),
}

export default api
