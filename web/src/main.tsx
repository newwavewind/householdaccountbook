import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { routerBasename } from './lib/appUrls'
import { registerAppServiceWorker } from './pwa/registerServiceWorker'
import { MemoDefaultsProvider } from './memo/MemoDefaultsContext'
import { ThemeProvider } from './theme/ThemeContext'
import './index.css'
import App from './App.tsx'

registerAppServiceWorker()

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <BrowserRouter basename={routerBasename()}>
      <ThemeProvider>
        <MemoDefaultsProvider>
          <App />
        </MemoDefaultsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </AppErrorBoundary>,
)
