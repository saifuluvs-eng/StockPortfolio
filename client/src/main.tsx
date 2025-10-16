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

createRoot(document.getElementById("root")!).render(
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
  </React.StrictMode>,
);
