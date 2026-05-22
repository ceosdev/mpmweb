import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/providers/theme-provider'
import { QueryProvider } from '@/providers/query-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { Toaster } from '@/components/ui/sonner'
import { FullPageLoader } from '@/components/full-page-loader'
import { router } from '@/routes/router'

/**
 * Application root — composes the global providers and renders the router.
 *
 *   ThemeProvider → QueryProvider → AuthProvider → Suspense → Router
 *
 * The Suspense boundary catches the lazy-loaded page chunks declared in
 * `routes/router.tsx` and shows the full-page loader while they fetch.
 */
export function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <Suspense fallback={<FullPageLoader />}>
            <RouterProvider router={router} />
          </Suspense>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
