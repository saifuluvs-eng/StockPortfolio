import { Route, Switch, Redirect, useLocation } from "wouter";
import { useState } from "react";


import RequireAuth from "@/auth/RequireAuth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
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
import HighPotentialPage from "@/pages/high-potential";
import LandingPage from "@/pages/LandingPage";

function ShellLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-white">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto bg-background text-foreground">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />

      <Route path="/login">
        <Redirect to="/account" />
      </Route>
      <Route path="/signup">
        <Redirect to="/account" />
      </Route>
      <Route path="/reset-password" component={ResetPassword} />

      <Route path="/dashboard">
        <ShellLayout>
          <Dashboard />
        </ShellLayout>
      </Route>
      <Route path="/portfolio">
        <ShellLayout>
          <Portfolio />
        </ShellLayout>
      </Route>
      <Route path="/gainers">
        <ShellLayout>
          <Gainers />
        </ShellLayout>
      </Route>
      <Route path="/analyse/:symbol?">
        <ShellLayout>
          <Analyse />
        </ShellLayout>
      </Route>
      <Route path="/watchlist">
        <ShellLayout>
          <RequireAuth>
            <Watchlist />
          </RequireAuth>
        </ShellLayout>
      </Route>
      <Route path="/alerts">
        <ShellLayout>
          <RequireAuth>
            <Alerts />
          </RequireAuth>
        </ShellLayout>
      </Route>
      <Route path="/account">
        <ShellLayout>
          <Account />
        </ShellLayout>
      </Route>
      <Route path="/ai-insights">
        <ShellLayout>
          <AIInsights />
        </ShellLayout>
      </Route>
      <Route path="/news">
        <ShellLayout>
          <News />
        </ShellLayout>
      </Route>
      <Route path="/high-potential">
        <ShellLayout>
          <HighPotentialPage />
        </ShellLayout>
      </Route>

      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
