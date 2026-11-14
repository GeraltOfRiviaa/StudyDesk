import { Navigate, Outlet } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Toaster } from "@/components/ui/toast"
import { useUser } from '@/AuthContext'

const Layout = () => {
  const { user, loading } = useUser()

  if (loading) return <div className="h-screen grid place-items-center w-screen">Loading...</div>
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col h-screen">
      <header>
        <Navbar/>
      </header>
      <main className="flex-1">
        <Outlet />
        <Toaster />
      </main>
    </div>
  )
}

export { Layout }