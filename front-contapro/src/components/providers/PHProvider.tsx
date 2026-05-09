'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({
  children,
}: {
  children: React.ReactNode
}) {
    useEffect(() => {
      // Usamos la variable de entorno o la clave directa como fallback para asegurar que funcione en producción
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_nqpUSxcabs7dS8JHWMfwMIBlmgIh4w2fObQGaPTQBN5'
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: false // Disable automatic pageview capture, as we capture manually
      })
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
