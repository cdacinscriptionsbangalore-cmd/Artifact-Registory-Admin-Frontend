import { type AxiosInstance } from 'axios'

export const errorInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.response?.status === 401) {
        // Dispatch a global event so React context can handle logout and UI updates
        try {
          window.dispatchEvent(new CustomEvent('app:unauthorized'))
        } catch {
          // fallback to hard navigation if CustomEvent is not supported
          window.location.href = '/admin/login'
        }
      }
      return Promise.reject(error)
    }
  )
}
