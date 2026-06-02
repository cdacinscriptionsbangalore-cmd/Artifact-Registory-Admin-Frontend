// src/utils/http/clients/coreBackend.client.ts
import { createAxiosClient } from '../axiosFactory'
import { attachAuthToken } from '../interceptors/authRequest.interceptor'
import { errorInterceptor } from '../interceptors/error.interceptor'
import { refreshTokenInterceptor } from '../interceptors/refreshToken.interceptor'
import { retryInterceptor } from '../interceptors/retry.interceptor'

declare global {
  interface Window {
    _env_?: {
      VITE_BACKEND_API_URL?: string
    }
  }
}

const backendApiUrl =
  (typeof window !== 'undefined' && window._env_?.VITE_BACKEND_API_URL) ||
  import.meta.env.VITE_BACKEND_API_URL ||
  '/api/'

// The Axios instance — used internally
const axiosInstance = createAxiosClient(backendApiUrl, [
  attachAuthToken,
  refreshTokenInterceptor,
  retryInterceptor,
  errorInterceptor,
])

// ← This is what Orval needs — a callable function that wraps the instance
// Orval calls this for every generated API request
export const coreBackendClient = <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const { body, ...config } = options

  return axiosInstance({
    ...config,
    url,
    data: body,
  }).then((response) => response.data)
}
