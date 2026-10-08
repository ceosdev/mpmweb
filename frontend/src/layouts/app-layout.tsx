import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'

const SIDEBAR_KEY = 'mpm.sidebar'

/**
 * Authenticated application shell: retractable sidebar + header + content.
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === 'collapsed'
  )

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded')
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={collapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader onToggleSidebar={toggleSidebar} />
        {/* `relative` makes <main> the containing block of absolutely
            positioned descendants (e.g. Radix Select's hidden native
            <select>), so they are clipped by its scroll instead of growing
            the document and creating a second, window-level scrollbar. */}
        <main className="relative flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
