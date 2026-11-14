import { Routes, Route } from 'react-router-dom';
import './App.css'
import { Settings } from './pages/Settings'
import { Library } from './pages/Library'
import { Home } from './pages/Dashboard'
import { Layout } from './Layout';
import { Login } from './pages/Login'
import { Register } from './pages/Register';

function App() {
  return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout/>}>
          <Route path="/dashboard" element={<Home />}/>
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings/>} />
        </Route>
      </Routes>
      
  )
}

export default App
