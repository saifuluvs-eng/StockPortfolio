import "./initApiBase";
import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";

import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "@/components/toast";

import App from "./App";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

let root: ReturnType<typeof createRoot> | null = null;

function render() {
  const app = (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Router hook={useHashLocation}>
            <FirebaseAuthProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </FirebaseAuthProvider>
          </Router>
        </ToastProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </React.StrictMode>
  );

  if (!root) {
    root = createRoot(rootElement);
  }
  root.render(app);
}

render();

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    render();
  });
}
