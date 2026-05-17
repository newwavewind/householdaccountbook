import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { routerBasename } from './lib/appUrls'
import './index.css'
import App from './App.tsx'

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={routerBasename()}>
    <App />
  </BrowserRouter>,
)
