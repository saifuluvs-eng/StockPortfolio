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
  // The returned component will be rendered by wouter's <Route>
  return function ProtectedComponent(props: React.ComponentProps<T>) {
    // I'm assuming your `useAuth` hook can provide an `isLoading` state.
    // This is crucial for handling async authentication checks.
    const { isAuthenticated, isLoading } = useAuth();

    // While checking auth, it's best to show nothing or a loading spinner.
    if (isLoading) {
      return null; // Or a <LoadingSpinner /> component
    }

    // If not authenticated, redirect to the landing page.
    if (!isAuthenticated) {
      return <Redirect to="/" />;
    }

    // If authenticated, render the actual component.
    return <Component {...props} />;
  };
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // By handling the loading state here, you prevent a "flash" of the landing page
  // for authenticated users when the app first loads.
  if (isLoading) {
    // You can render a full-page loader here
    return <div>Loading Application...</div>;
  }

  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Home : Landing} />
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
