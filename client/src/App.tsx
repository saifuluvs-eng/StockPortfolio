import React from "react";
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
import HighPotential from "@/pages/high-potential";
import Gainers from "@/pages/gainers";
import AIInsights from "@/pages/ai-insights";
import Charts from "@/pages/charts";

// HOC: require auth
function Protected<T extends React.ComponentType<any>>(Component: T) {
  return function ProtectedComponent(props: React.ComponentProps<T>) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return null; // could show spinner
    if (!isAuthenticated) return <Redirect to="/" />;

    return <Component {...props} />;
  };
}

// HOC: wrap a page with the AppLayout (adds Sidebar etc.)
const withLayout =
  <P,>(Comp: React.ComponentType<P>) =>
  (props: P) =>
    (
      <AppLayout>
        <Comp {...props} />
      </AppLayout>
    );

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading Application...</div>;
  }

  return (
    <Switch>
      {/* Public root: Landing when logged out, Dashboard(Home) when logged in */}
      <Route
        path="/"
        component={isAuthenticated ? withLayout(Home) : Landing}
      />

      {/* Dashboard (now wrapped with layout so Sidebar appears) */}
      <Route path="/dashboard" component={withLayout(Home)} />

      {/* Secured routes (auth + layout) */}
      <Route path="/portfolio" component={Protected(withLayout(Portfolio))} />
      <Route
        path="/high-potential"
        component={Protected(withLayout(HighPotential))}
      />
      <Route path="/gainers" component={Protected(withLayout(Gainers))} />
      <Route
        path="/ai-insights"
        component={Protected(withLayout(AIInsights))}
      />
      <Route path="/charts" component={Protected(withLayout(Charts))} />
      <Route path="/scan" component={Protected(withLayout(Charts))} />

      {/* 404 fallback (public; no layout to keep it simple) */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="cryptotrader-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
