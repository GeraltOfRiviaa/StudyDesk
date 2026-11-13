
import { Navbar } from './components/Navbar'
import { Outlet } from 'react-router-dom'
import { Toaster } from "@/components/ui/toast"

const Layout = ({ email, nickname }) => {

  return (
    <div className="flex flex-col h-screen">
      <header>
        <Navbar user_nickname={nickname} />
      </header>
      <main className="flex-1">
        <Outlet context={email} />
        <Toaster />
      </main>
    </div>
  )
}

export { Layout }