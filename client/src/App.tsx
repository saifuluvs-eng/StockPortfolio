import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Dashboard from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Gainers from "@/pages/gainers";
import Analyse from "@/pages/analyse";

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
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<ShellLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/gainers" element={<Gainers />} />
          <Route path="/analyse" element={<Analyse />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
