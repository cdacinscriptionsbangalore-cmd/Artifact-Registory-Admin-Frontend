import { useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { authClient } from '@/utils/http/clients/authClient.client'
import AuthContext from '@/context/AuthContext'
import cdacRoundLogo from '@/assets/cdacroundlogo.png'
import { getPostLoginRedirect } from '@/utils/postLoginRedirect'

const MAX_REFRESH_RETRIES = 3
const RETRY_DELAY_MS = 700
const OAUTH_CALLBACK_GUARD_KEY = 'auth:oauth-callback-processed'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const OAuthCallback = () => {
  const navigate = useNavigate()
  const { loginSuccess } = useContext(AuthContext)

  useEffect(() => {
    // React StrictMode runs effects twice in development.
    // Guard prevents a second callback pass from overriding the first successful redirect.
    if (sessionStorage.getItem(OAUTH_CALLBACK_GUARD_KEY) === '1') {
      return
    }
    sessionStorage.setItem(OAUTH_CALLBACK_GUARD_KEY, '1')

    const navigateToLoginWithNext = () => {
      sessionStorage.removeItem(OAUTH_CALLBACK_GUARD_KEY)
      const next = getPostLoginRedirect()
      if (next) {
        navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }

    const completeLogin = async () => {
      try {
        let accessToken: string | null = null
        let lastError: unknown = null

        for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
          try {
            console.log(`OAuthCallback: refresh attempt ${attempt}/${MAX_REFRESH_RETRIES}`)
            const res = await authClient.post('/oauth2/authenticated/refresh-token')
            console.log('OAuthCallback: refresh response:', res && res.data)

            accessToken =
              res?.data?.data?.accessToken || res?.data?.auth_token || res?.data?.token || null
            console.log('OAuthCallback: computed accessToken:', accessToken)

            if (accessToken) break
            lastError = new Error('No access token found in refresh response')
          } catch (error) {
            lastError = error
            console.warn(`OAuthCallback: refresh attempt ${attempt} failed`, {
              message: (error as AxiosError)?.message,
              status: (error as AxiosError)?.response?.status,
            })
          }

          if (attempt < MAX_REFRESH_RETRIES) {
            await wait(RETRY_DELAY_MS * attempt)
          }
        }

        if (accessToken) {
          if (!loginSuccess(accessToken)) {
            throw new Error('This account does not have admin access')
          }

          const savedRedirect = getPostLoginRedirect()

          if (savedRedirect && savedRedirect.startsWith('/') && !savedRedirect.startsWith('//')) {
            navigate(savedRedirect, { replace: true })
          } else {
            alert('redicrexting to admin/dashboard')
            navigate('/admin/dashboard', { replace: true })
          }
        } else {
          throw lastError || new Error('OAuth callback failed without an access token')
        }
      } catch (error) {
        console.error('Error completing OAuth login:', {
          message: (error as AxiosError)?.message,
          response: (error as AxiosError)?.response?.data,
          status: (error as AxiosError)?.response?.status,
        })
        navigateToLoginWithNext()
      }
    }

    completeLogin()
  }, [loginSuccess, navigate])

  return (
    <div className="bg-secondary-background flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center">
        {/* <FaSpinner className="animate-spin text-4xl text-[#66B0FF]" /> */}
        <img src={cdacRoundLogo} className="cdacSpinner mr-3 mb-4 size-20" alt="Loading spinner" />
        <div className="text-lg text-[#000000]">Logging in...</div>
      </div>
    </div>
  )
}

export default OAuthCallback
