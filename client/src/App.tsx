// client/src/App.tsx
import React, { useEffect } from "react";
import type { RouteComponentProps } from "wouter";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { useAuth } from "@/hooks/useAuth";

import { AppLayout } from "@/components/layout/app-layout";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Gainers from "@/pages/gainers";
import AIInsights from "@/pages/ai-insights";
import Charts from "@/pages/charts";
import Analyse from "@/pages/analyse";
import Watchlist from "@/pages/watchlist";
import Alerts from "@/pages/alerts";
import News from "@/pages/news";
import { useCredits } from "@/stores/creditStore";

// (keep for later) Protected HOC
function Protected<T extends React.ComponentType<any>>(Component: T) {
  return function ProtectedComponent(props: React.ComponentProps<T>) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return null;
    if (!isAuthenticated) return <Redirect to="/" />;
    return <Component {...props} />;
  };
}

// Wrap pages with Sidebar/Layout
type DefaultRouteParams = Record<string, string | undefined>;

type ExtractRouteParams<P> = P extends RouteComponentProps<infer Params>
  ? Params
  : DefaultRouteParams;

const withLayout = <C extends React.ComponentType<any>>(Component: C) => {
  type Props = React.ComponentProps<C>;
  type Params = ExtractRouteParams<Props>;
  type RouteProps = RouteComponentProps<Params>;
  type CombinedProps = RouteProps & Omit<Props, keyof RouteProps>;

  const WithLayoutComponent: React.FC<CombinedProps> = (props) => (
    <AppLayout>
      <Component {...(props as Props)} />
    </AppLayout>
  );

  const displayName = Component.displayName || Component.name || "Component";
  WithLayoutComponent.displayName = `WithLayout(${displayName})`;

  return WithLayoutComponent;
};

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading Application...</div>;

  return (
    <Switch>
      {/* Root: landing when logged out, dashboard(Home) when logged in */}
      <Route
        path="/"
        component={isAuthenticated ? withLayout(Home) : Landing}
      />

      {/* PUBLIC routes */}
      <Route path="/dashboard" component={withLayout(Home)} />
      <Route path="/portfolio" component={withLayout(Portfolio)} />
      <Route path="/gainers" component={withLayout(Gainers)} />
      <Route path="/ai-insights" component={withLayout(AIInsights)} />
      <Route path="/watchlist" component={withLayout(Watchlist)} />
      <Route path="/alerts" component={withLayout(Alerts)} />
      <Route path="/news" component={withLayout(News)} />

      {/* ANALYSE */}
      <Route path="/analyse/:symbol?" component={withLayout(Analyse)} />

      {/* CHARTS */}
      <Route path="/charts/:symbol?" component={withLayout(Charts)} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, authReady } = useAuth();
  const init = useCredits((state) => state.init);
  const ready = useCredits((state) => state.ready);
  const userId = user?.uid ?? null;

  useEffect(() => {
    if (!authReady) return;
    init(userId);
  }, [authReady, init, userId]);

  if (!ready) {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="cryptotrader-theme">
        <TooltipProvider>
          <Toaster />
          <AppShell>
            <AppRouter />
          </AppShell>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
