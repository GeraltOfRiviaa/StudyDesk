import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from '@/providers/AuthProvider'
import { ItemModalProvider } from './context/ItemsModalContext';
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { queryClient } from "@/lib/queryClient"


createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ItemModalProvider>
          <App />
          <ReactQueryDevtools initialIsOpen={false} />
        </ItemModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>,
)
