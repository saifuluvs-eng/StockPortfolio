import { Switch, Route, useLocation } from "wouter";
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

// Protected route wrapper component - DISABLED auth loop fix
function Protected(Component: React.ComponentType<any>) {
  return function ProtectedComponent(props: any) {
    // Temporarily disable auth checks to fix infinite loop
    return <Component {...props} />;
  };
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/landing" component={Landing} />
      <Route path="/portfolio" component={Protected(Portfolio)} />
      <Route path="/high-potential" component={Protected(HighPotential)} />
      <Route path="/gainers" component={Protected(Gainers)} />
      <Route path="/ai-insights" component={Protected(AIInsights)} />
      <Route path="/charts" component={Protected(Charts)} />
      <Route path="/scan" component={Protected(Charts)} />
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
