import { create } from 'zustand'
import { authApi } from '../api/client'

const useAuthStore = create((set) => ({
  athlete: null,
  loading: true,

  fetchMe: async () => {
    try {
      const { data } = await authApi.me()
      set({ athlete: data, loading: false })
    } catch {
      set({ athlete: null, loading: false })
    }
  },

  logout: async () => {
    await authApi.logout()
    set({ athlete: null })
    window.location.href = '/'
  },
}))

export default useAuthStore
