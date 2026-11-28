import { Navigate, Outlet } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Toaster } from "@/components/ui/toast"
import { useUser } from '@/context/AuthContext'
import { ThemeProvider } from "@/providers/ThemeProvider"
import { ItemModalProvider } from "@/context/ItemsModalContext"
import { Button } from "@/components/ui/button"

const Layout = () => {
  const { user, session, loading, accountDeleted, verificationFailed, refreshUser } = useUser()

  if (loading) return <div className="h-screen grid place-items-center w-screen">Loading...</div>
  if (!user || !session) {
    if (verificationFailed) return (
      <div className="grid h-screen place-content-center gap-3 text-center">
        <p role="alert">Could not verify your session.</p>
        <Button type="button" onClick={refreshUser}>Retry</Button>
      </div>
    )
    return <Navigate to="/login" replace state={{ accountDeleted }} />
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <ItemModalProvider key={session.version}>
      <div className="flex flex-col h-dvh gap-2 p-2 overflow-hidden">
          <Navbar/>
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
        <Toaster />
      </div>
      </ItemModalProvider>
    </ThemeProvider>
  )
}

export { Layout }
