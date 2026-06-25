import { createAxiosClient } from '../axiosFactory'

const backendApiUrl =
  window._env_?.VITE_BACKEND_API_URL || import.meta.env.VITE_BACKEND_API_URL || '/api/'
// FOR CALLING PUBLIC BACKEND APIS

export const apiClient = createAxiosClient(backendApiUrl, [])
