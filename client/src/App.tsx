import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthContext";
import RequireAuth from "@/auth/RequireAuth";
import Sidebar from "@/components/layout/Sidebar";
import Dashboard from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Gainers from "@/pages/gainers";
import Analyse from "@/pages/analyse";
import Watchlist from "@/pages/watchlist";
import Alerts from "@/pages/alerts";
import Account from "@/pages/Account";
import AIInsights from "@/pages/ai-insights";
import News from "@/pages/news";
import ResetPassword from "@/pages/ResetPassword";

function ShellLayout() {
  return (
    <div className="flex min-h-screen bg-[#0f0f0f] text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background text-foreground">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/login" element={<Navigate to="/account" replace />} />
          <Route path="/signup" element={<Navigate to="/account" replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ShellLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/gainers" element={<Gainers />} />
            <Route path="/analyse" element={<Analyse />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <Account />
                </RequireAuth>
              }
            />
            <Route path="/ai-insights" element={<AIInsights />} />
            <Route path="/news" element={<News />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
