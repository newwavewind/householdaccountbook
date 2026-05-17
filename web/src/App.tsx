import { Route, Routes } from 'react-router-dom'
import { CommunityAuthProvider } from './community/CommunityAuthContext'
import { LedgerProvider } from './hooks/useLedger'
import LedgerApp from './LedgerApp'
import RootLayout from './layout/RootLayout'
import BulkInputPage from './pages/BulkInputPage'
import CalendarPage from './pages/CalendarPage'
import DDaySettingsPage from './pages/DDaySettingsPage'
import AdminModerationPage from './pages/AdminModerationPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import CommunityListPage from './pages/CommunityListPage'
import CommunityPostDetailPage from './pages/CommunityPostDetailPage'
import CommunityPostEditorPage from './pages/CommunityPostEditorPage'
import AuthSetupPage from './pages/AuthSetupPage'
import { RequireAdmin, RequireAuth } from './routes/RouteGuards'

export default function App() {
  return (
    <CommunityAuthProvider>
      <LedgerProvider>
        <Routes>
        <Route element={<RootLayout />}>
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/calendar/dday" element={<DDaySettingsPage />} />
          <Route path="/input" element={<BulkInputPage />} />
          <Route path="/" element={<LedgerApp />} />
          <Route path="/community" element={<CommunityListPage />} />
          <Route
            path="/community/new"
            element={
              <RequireAuth>
                <CommunityPostEditorPage mode="new" />
              </RequireAuth>
            }
          />
          <Route
            path="/community/:id/edit"
            element={
              <RequireAuth>
                <CommunityPostEditorPage mode="edit" />
              </RequireAuth>
            }
          />
          <Route path="/community/:id" element={<CommunityPostDetailPage />} />
          <Route path="/auth/setup" element={<AuthSetupPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminModerationPage />
              </RequireAdmin>
            }
          />
        </Route>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </LedgerProvider>
    </CommunityAuthProvider>
  )
}
