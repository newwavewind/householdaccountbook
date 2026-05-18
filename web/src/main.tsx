import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { routerBasename } from './lib/appUrls'
import { registerAppServiceWorker } from './pwa/registerServiceWorker'
import { ThemeProvider } from './theme/ThemeContext'
import './index.css'
import App from './App.tsx'

registerAppServiceWorker()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={routerBasename()}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </BrowserRouter>,
)
