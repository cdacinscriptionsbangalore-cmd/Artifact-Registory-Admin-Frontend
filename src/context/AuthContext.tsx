// context/AuthContext.tsx
import React, { createContext, useState, useEffect, useRef, useCallback } from 'react'
import type { AxiosError } from 'axios'
import { authStore } from '@store/authStore'
import { authClient } from '@/utils/http/clients/authClient.client'
import { apiClient } from '@/utils/http/clients/backendApiClientGeneral'
import { setPostLoginRedirect } from '@/utils/postLoginRedirect'

type AuthContextType = {
  isAuthenticated: boolean
  isLoading: boolean
  loginSuccess: (token: string) => void
  logout: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType>(null!)
const AUTH_SYNC_STORAGE_KEY = 'auth:sync-event'

export const AuthProvider = (props: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const hasLoginSucceededRef = useRef(false)
  const hasForcedLogoutRef = useRef(false)

  const navigateToLogin = useCallback((preserveCurrentPath: boolean) => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const isAuthFlowPath =
      window.location.pathname === '/admin/login' ||
      window.location.pathname === '/admin/oauth/callback'

    if (preserveCurrentPath && !isAuthFlowPath) {
      setPostLoginRedirect(currentPath)
    }

    if (!isAuthFlowPath) {
      window.location.href = `/admin/login?next=${encodeURIComponent(currentPath)}`
      return
    }

    if (window.location.pathname !== '/admin/login') {
      window.location.href = '/admin/login'
    }
  }, [])

  const forceLoggedOutState = useCallback(
    ({
      reason,
      broadcast,
      redirect,
      preserveCurrentPath,
    }: {
      reason: string
      broadcast: boolean
      redirect: boolean
      preserveCurrentPath: boolean
    }) => {
      hasLoginSucceededRef.current = false
      hasForcedLogoutRef.current = true
      authStore.clear()
      setIsAuthenticated(false)
      setIsLoading(false)

      if (broadcast) {
        try {
          localStorage.setItem(
            AUTH_SYNC_STORAGE_KEY,
            JSON.stringify({
              type: 'logout',
              reason,
              at: Date.now(),
            })
          )
        } catch (error) {
          console.warn('AuthContext: failed to broadcast auth sync event', error)
        }
      }

      if (redirect) {
        navigateToLogin(preserveCurrentPath)
      }
    },
    [navigateToLogin]
  )

  const loginSuccess = (token: string) => {
    authStore.setToken(token)
    hasLoginSucceededRef.current = true
    hasForcedLogoutRef.current = false
    console.log('Token received in AuthContext:', token)
    if (typeof token === 'undefined' || token === null) {
      try {
        const stack = new Error().stack
        console.warn('loginSuccess called with undefined token, stack:\n', stack)
      } catch {
        // intentional empty catch for stack logging
      }
    }
    setIsAuthenticated(true)
  }

  const logout = async () => {
    forceLoggedOutState({
      reason: 'manual-logout',
      broadcast: true,
      redirect: false,
      preserveCurrentPath: false,
    })
    try {
      const res = await apiClient.post('/oauth2/logout')
      console.log('Logout response:', res)
      if (res.status === 200) {
        console.log('Logout successful')
        return true
      }
      return false
    } catch (error) {
      console.error('Logout failed:', {
        message: (error as AxiosError)?.message,
        response: (error as AxiosError)?.response?.data,
        status: (error as AxiosError)?.response?.status,
      })
      return false
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true)
      try {
        console.log('AuthContext.bootstrap: attempting refresh-token call')
        const res = await authClient.post('/oauth2/authenticated/refresh-token')
        console.log('AuthContext.bootstrap: refresh response:', res && res.data)

        const token = res?.data?.auth_token || res?.data?.data?.accessToken || res?.data?.token
        console.log('AuthContext.bootstrap: computed token:', token)
        if (token) {
          if (hasForcedLogoutRef.current) {
            console.warn(
              'AuthContext.bootstrap: ignoring refresh success due to forced logout state'
            )
          } else {
            loginSuccess(token)
            console.log('useEffect in AuthContext: User is authenticated.')
          }
        } else {
          console.warn('AuthContext.bootstrap: no token found in refresh response', res?.data)
          // Avoid stale bootstrap response overriding a successful OAuth callback login.
          if (!hasLoginSucceededRef.current && !authStore.getToken()) {
            authStore.clear()
            setIsAuthenticated(false)
          }
        }
      } catch (error) {
        console.error('AuthContext.bootstrap: refresh failed:', {
          message: (error as AxiosError)?.message,
          response: (error as AxiosError)?.response?.data,
          status: (error as AxiosError)?.response?.status,
        })
        // Avoid stale bootstrap failure overriding a successful OAuth callback login.
        if (!hasLoginSucceededRef.current && !authStore.getToken()) {
          authStore.clear()
          setIsAuthenticated(false)
        }
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
    // run only once on mount
  }, [])

  // Listen for global unauthorized events emitted by axios interceptors
  useEffect(() => {
    const handleUnauthorized = () => {
      console.log('AuthContext: received app:unauthorized event, forcing logout')
      forceLoggedOutState({
        reason: 'unauthorized',
        broadcast: true,
        redirect: true,
        preserveCurrentPath: true,
      })
    }

    window.addEventListener('app:unauthorized', handleUnauthorized as EventListener)
    return () => window.removeEventListener('app:unauthorized', handleUnauthorized as EventListener)
  }, [forceLoggedOutState])

  useEffect(() => {
    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return

      try {
        const parsedEvent = JSON.parse(event.newValue) as {
          type?: string
          reason?: string
          at?: number
        }

        if (parsedEvent?.type !== 'logout') return
        console.log(
          'AuthContext: received cross-tab logout sync event',
          parsedEvent?.reason || 'unknown'
        )
      } catch (error) {
        console.warn('AuthContext: invalid auth sync event payload', error)
        return
      }

      forceLoggedOutState({
        reason: 'cross-tab-logout',
        broadcast: false,
        redirect: true,
        preserveCurrentPath: true,
      })
    }

    window.addEventListener('storage', handleStorageSync)
    return () => window.removeEventListener('storage', handleStorageSync)
  }, [forceLoggedOutState])

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, loginSuccess, logout }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export default AuthContext
