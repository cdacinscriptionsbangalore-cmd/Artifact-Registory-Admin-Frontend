import React from 'react'
import { useLocation } from 'react-router-dom'
import { setPostLoginRedirect } from '@/utils/postLoginRedirect'
import LoginCard from '@/LoginCard'
// import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
// import { jwtDecode } from "jwt-decode";
// import { redirect } from "react-router-dom";

const redirectURL = window._env_?.VITE_REDIRECT_URL || import.meta.env.VITE_REDIRECT_URL
const OAUTH_CALLBACK_GUARD_KEY = 'auth:oauth-callback-processed'

const AuthPage: React.FC = () => {
  const location = useLocation()

  const getSafeRedirectPath = () => {
    const next = new URLSearchParams(location.search).get('next') || ''
    if (next.startsWith('/') && !next.startsWith('//')) {
      return next
    }

    const from =
      location.state && typeof (location.state as { from?: unknown }).from === 'string'
        ? (location.state as { from: string }).from
        : ''

    if (from.startsWith('/') && !from.startsWith('//')) {
      return from
    }
    console.log('From getSafeRedirectPath:', { next, from })
    return null
  }

  // const handleLoginSuccess = (credentialResponse: any) => {
  //   if (credentialResponse.credential) {
  //     const decoded: any = jwtDecode(credentialResponse.credential);
  //     console.log("User Info:", decoded);
  //     // You can send credentialResponse.credential to your backend for verification
  //   }
  // };

  // const handleLoginFailure = () => {
  //   console.error("Login Failed");
  // };
  const handleGoogleLogin = () => {
    const redirectPath = getSafeRedirectPath()

    if (redirectPath) {
      setPostLoginRedirect(redirectPath)
    }
    // Reset callback guard before initiating a new OAuth round-trip.
    sessionStorage.removeItem(OAUTH_CALLBACK_GUARD_KEY)
    alert(redirectURL)
    window.location.href = redirectURL
  }

  return <LoginCard handleGoogleLogin={handleGoogleLogin} />
}

export default AuthPage
