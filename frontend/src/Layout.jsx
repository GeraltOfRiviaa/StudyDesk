import { Navigate, Outlet } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Toaster } from "@/components/ui/toast"
import { useUser } from '@/context/AuthContext'
import { ThemeProvider } from "@/providers/ThemeProvider"

const Layout = () => {
  const { user, loading, accountDeleted } = useUser()

  if (loading) return <div className="h-screen grid place-items-center w-screen">Loading...</div>
  if (!user) return <Navigate to="/login" replace state={{ accountDeleted }} />

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex flex-col h-dvh gap-2 p-2 overflow-hidden">
          <Navbar/>
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </ThemeProvider>
  )
}

export { Layout }
