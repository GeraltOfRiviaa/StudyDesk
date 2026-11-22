import { Routes, Route } from 'react-router-dom';
import './App.css'
import { Settings } from './pages/Settings'
import { Library } from './pages/Library'
import { Home } from './pages/Dashboard'
import { Layout } from './Layout';
import { Login } from './pages/Login'
import { Register } from './pages/Register';
import { ChangePassword } from './pages/ChangePassword';

function App() {
  return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<Layout/>}>
          <Route path="/" element={<Home />}/>
          <Route path="/library" element={<Library />} />
          <Route path="/settings" element={<Settings/>} />
          <Route path="/settings/change/password" element={<ChangePassword/>} />
        </Route>
      </Routes>
      
  )
}

export default App
