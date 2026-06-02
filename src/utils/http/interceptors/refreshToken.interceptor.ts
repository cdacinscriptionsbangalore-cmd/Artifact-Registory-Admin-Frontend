import { authStore } from '../../../store/authStore'
import { authClient } from '../clients/authClient.client'
import { type AxiosInstance, type AxiosError } from 'axios'

let isRefreshing = false
let pendingQueue: ((token: string) => void)[] = []

const processQueue = (token: string) => {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

export const refreshTokenInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config

      console.error('refreshToken.interceptor caught response error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: originalRequest?.url,
        method: originalRequest?.method,
      })

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true

        // If refresh already in progress, wait
        if (isRefreshing) {
          return new Promise((resolve) => {
            pendingQueue.push((token: string) => {
              originalRequest.headers = originalRequest.headers || {}
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(client(originalRequest))
            })
          })
        }

        isRefreshing = true

        try {
          console.log(
            'refreshToken.interceptor: attempting token refresh for request:',
            originalRequest?.url
          )
          const res = await authClient.post('/oauth2/authenticated/refresh-token')
          console.log('refreshToken.interceptor: refresh response:', res && res.data)

          const newAccessToken =
            res?.data?.auth_token || res?.data?.data?.accessToken || res?.data?.token

          console.log('refreshToken.interceptor: computed newAccessToken:', newAccessToken)

          if (!newAccessToken) {
            console.error(
              'refreshToken.interceptor: no access token found in refresh response',
              res?.data
            )
            throw new Error('No access token in refresh response')
          }

          if (!authStore.setToken(newAccessToken)) {
            throw new Error('Refreshed token does not grant admin access')
          }
          console.log(
            'Token refreshed in refreshToken.interceptor:',
            newAccessToken,
            'pendingQueueLength:',
            pendingQueue.length
          )
          processQueue(newAccessToken)

          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return client(originalRequest)
        } catch (refreshError) {
          console.error('refreshToken.interceptor: refresh failed:', {
            message: (refreshError as AxiosError)?.message,
            response: (refreshError as AxiosError)?.response?.data,
            status: (refreshError as AxiosError)?.response?.status,
          })
          authStore.clear()
          try {
            window.dispatchEvent(new CustomEvent('app:unauthorized'))
          } catch {
            window.location.href = '/admin/login'
          }
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      return Promise.reject(error)
    }
  )
}
