import { BrowserRouter, Routes, Route} from 'react-router-dom';
import {Navbar} from "@/components/Navbar"
import './App.css'
import {Settings} from './pages/Settings'
import {Library} from './pages/Library'
function App() {
  return (
    <BrowserRouter>
      
      <Navbar/>
      
      <Routes>
        <Route path="/library" element={<Library />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>

    </BrowserRouter>
  )
}

export default App
