
import {Navbar} from './components/Navbar'
import { Outlet } from 'react-router-dom'
import { Toaster } from "@/components/ui/toast"

const Layout = ({email, nickname}) => {

  return (
    <div>
    <Navbar user_nickname={nickname} />
    <main>
        <Outlet context={email}/>
        <Toaster/>
    </main>
    </div>
  )
}

export { Layout }