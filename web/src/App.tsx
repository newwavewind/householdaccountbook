import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CommunityAuthProvider } from "./community/CommunityAuthContext";
import { LedgerProvider } from "./hooks/useLedger";
import LedgerApp from "./LedgerApp";
import RootLayout from "./layout/RootLayout";
import BulkInputPage from "./pages/BulkInputPage";
import CalendarPage from "./pages/CalendarPage";
import DDaySettingsPage from "./pages/DDaySettingsPage";
import AdminModerationPage from "./pages/AdminModerationPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import CommunityListPage from "./pages/CommunityListPage";
import CommunityPostDetailPage from "./pages/CommunityPostDetailPage";
import CommunityPostEditorPage from "./pages/CommunityPostEditorPage";
import AuthSetupPage from "./pages/AuthSetupPage";
import NicknameSetupPage from "./pages/NicknameSetupPage";
import SettingsHubPage from "./pages/SettingsHubPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import AppearanceSettingsPage from "./pages/AppearanceSettingsPage";
import DiaryRecoveryPage from "./pages/DiaryRecoveryPage";
import { lazy, Suspense } from "react";
const AppRevenuePage = lazy(() => import("./pages/AppRevenuePage"));
import { CalendarDecorationProvider } from "./calendar/CalendarDecorationContext";
import { RequireAdmin, RequireNickname } from "./routes/RouteGuards";

function HomeRedirect() {
  const loc = useLocation();
  return (
    <Navigate
      to={{ pathname: "/calendar", search: loc.search, hash: loc.hash }}
      replace
    />
  );
}

export default function App() {
  return (
    <CommunityAuthProvider>
      <LedgerProvider>
        <CalendarDecorationProvider>
          <Routes>
            <Route element={<RootLayout />}>
              <Route
                path="/calendar/recovery"
                element={<DiaryRecoveryPage />}
              />
              <Route path="/calendar/dday" element={<DDaySettingsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/input" element={<BulkInputPage />} />
              <Route path="/settings" element={<SettingsHubPage />} />
              <Route
                path="/settings/account"
                element={<AccountSettingsPage />}
              />
              <Route
                path="/settings/appearance"
                element={<AppearanceSettingsPage />}
              />
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/ledger" element={<LedgerApp />} />
              <Route
                path="/app-revenue"
                element={
                  <Suspense
                    fallback={
                      <div role="status" className="p-8 text-center text-sm">
                        앱 수익을 불러오는 중…
                      </div>
                    }
                  >
                    <AppRevenuePage />
                  </Suspense>
                }
              />
              <Route path="/community" element={<CommunityListPage />} />
              <Route
                path="/community/new"
                element={
                  <RequireNickname>
                    <CommunityPostEditorPage mode="new" />
                  </RequireNickname>
                }
              />
              <Route
                path="/community/:id/edit"
                element={
                  <RequireNickname>
                    <CommunityPostEditorPage mode="edit" />
                  </RequireNickname>
                }
              />
              <Route
                path="/community/:id"
                element={<CommunityPostDetailPage />}
              />
              <Route path="/auth/setup" element={<AuthSetupPage />} />
              <Route path="/auth/nickname" element={<NicknameSetupPage />} />
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
        </CalendarDecorationProvider>
      </LedgerProvider>
    </CommunityAuthProvider>
  );
}
