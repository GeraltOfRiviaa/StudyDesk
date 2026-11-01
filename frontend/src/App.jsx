import { BrowserRouter, Routes, Route} from 'react-router-dom';
import {Navbar} from "@/components/Navbar"
import './App.css'
import {Settings} from './pages/Settings'
import {Library} from './pages/Library'
import {Home} from './pages/Dashboard'
function App() {
  {/* Use API to get the actual nickname and email of the user */}
  const nickname = "Myrril"
  const email = "temp@email.com"

  return (
    <BrowserRouter>

      <Navbar user_nickname={nickname}/>
      
      <Routes>
        <Route path="/" element={<Home />}/>
        <Route path="/library" element={<Library />} />
        <Route path="/settings" element={<Settings nickname={nickname} email={email}/>} />
      </Routes>

    </BrowserRouter>
  )
}

export default App
