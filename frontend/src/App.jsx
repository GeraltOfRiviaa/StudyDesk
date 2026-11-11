import { Routes, Route } from 'react-router-dom';
import './App.css'
import { Settings } from './pages/Settings'
import { Library } from './pages/Library'
import { Home } from './pages/Dashboard'
import { Layout } from './Layout';
import { Login } from './pages/Login'
import { Register } from './pages/Register';
import { RequireToken } from "./Auth";





function App() {
  {/* Use API to get the actual nickname and email of the user */ }
  const nickname = "Myrril"
  const email = "temp@email.com"

  return (
      <Routes>
        <Route element={<Layout email={email} nickname={nickname}/>}>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<RequireToken><Home /></RequireToken>}/>
          <Route path="/library" element={<RequireToken><Library /></RequireToken>} />
          <Route path="/settings" element={<RequireToken><Settings nickname={nickname} email={email} /></RequireToken>} />
        </Route>
      </Routes>
      
  )
}

export default App
