// client/src/App.tsx
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
      <Route path="/high-potential" component={withLayout(HighPotential)} />
      <Route path="/gainers" component={withLayout(Gainers)} />
      <Route path="/ai-insights" component={withLayout(AIInsights)} />

      {/* CHARTS */}
      <Route path="/charts/:symbol?" component={withLayout(Charts)} />

      {/* 404 */}
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
