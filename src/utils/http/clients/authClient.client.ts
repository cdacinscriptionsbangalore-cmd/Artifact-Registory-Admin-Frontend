import { createAxiosClient } from '../axiosFactory'
// import { debugAuthInterceptor } from "../interceptors/debugAuthInterceptor.interceptor";

const backendApiUrl =
  window._env_?.VITE_BACKEND_API_URL || import.meta.env.VITE_BACKEND_API_URL || '/api/'

// FOR REFRESH TOKEN
export const authClient = createAxiosClient(backendApiUrl, [])
