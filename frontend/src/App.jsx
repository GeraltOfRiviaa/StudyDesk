import { Routes, Route } from 'react-router-dom';
import './App.css'
import { Settings } from './pages/Settings'
import { Library } from './pages/Library'
import { Home } from './pages/Dashboard'
import { Layout } from './Layout';
import { Login } from './pages/Login'
import { Register } from './pages/Register';




function App() {
  {/* Use API to get the actual nickname and email of the user */ }
  const nickname = "Myrril"
  const email = "temp@email.com"

  return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout email={email} nickname={nickname}/>}>
          <Route path="/dashboard" element={<Home />}/>
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings nickname={nickname} email={email} />} />
        </Route>
      </Routes>
      
  )
}

export default App
