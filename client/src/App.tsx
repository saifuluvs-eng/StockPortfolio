import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { useAuth } from "@/hooks/useAuth";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import HighPotential from "@/pages/high-potential";
import Gainers from "@/pages/gainers";
import AIInsights from "@/pages/ai-insights";
import Charts from "@/pages/charts";

// Protected route Higher-Order Component (HOC)
function Protected<T extends React.ComponentType<any>>(Component: T) {
  return function ProtectedComponent(props: React.ComponentProps<T>) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return null; // or a <LoadingSpinner />
    }

    if (!isAuthenticated) {
      return <Redirect to="/" />;
    }

    return <Component {...props} />;
  };
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading Application...</div>;
  }

  return (
    <Switch>
      {/* Public root: Landing when logged out, Home when logged in */}
      <Route path="/" component={isAuthenticated ? Home : Landing} />

      {/* ✅ Dedicated Dashboard route (secured) */}
      <Route path="/dashboard" component={Protected(Home)} />

      {/* Other secured routes */}
      <Route path="/portfolio" component={Protected(Portfolio)} />
      <Route path="/high-potential" component={Protected(HighPotential)} />
      <Route path="/gainers" component={Protected(Gainers)} />
      <Route path="/ai-insights" component={Protected(AIInsights)} />
      <Route path="/charts" component={Protected(Charts)} />
      <Route path="/scan" component={Protected(Charts)} />

      {/* 404 fallback */}
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
