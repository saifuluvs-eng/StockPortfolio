import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import HighPotential from "@/pages/high-potential";
import Gainers from "@/pages/gainers";
import AIInsights from "@/pages/ai-insights";
import Charts from "@/pages/charts";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <AppLayout>
          <Home />
        </AppLayout>
      </Route>
      <Route path="/portfolio">
        <AppLayout>
          <Portfolio />
        </AppLayout>
      </Route>
      <Route path="/high-potential">
        <AppLayout>
          <HighPotential />
        </AppLayout>
      </Route>
      <Route path="/gainers">
        <AppLayout>
          <Gainers />
        </AppLayout>
      </Route>
      <Route path="/ai-insights">
        <AppLayout>
          <AIInsights />
        </AppLayout>
      </Route>
      <Route path="/charts">
        <AppLayout>
          <Charts />
        </AppLayout>
      </Route>
      <Route path="/scan">
        <AppLayout>
          <Charts />
        </AppLayout>
      </Route>
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
