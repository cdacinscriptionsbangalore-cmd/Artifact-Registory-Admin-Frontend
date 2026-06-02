// auth/authStore.ts (NOT a hook)
import { jwtDecode } from 'jwt-decode'

let accessToken: string | null = null

type AccessTokenClaims = {
  role?: string
}

const hasAdminRole = (token: string) => {
  try {
    return jwtDecode<AccessTokenClaims>(token).role?.toLowerCase() === 'admin'
  } catch {
    return false
  }
}

export const authStore = {
  getToken() {
    console.log('Getting token in authStore:', accessToken)
    return accessToken
  },

  setToken(token: string) {
    if (!hasAdminRole(token)) {
      accessToken = null
      return false
    }

    console.log('Setting token in authStore:', token)
    accessToken = token
    return true
  },

  clear() {
    accessToken = null
  },
}
