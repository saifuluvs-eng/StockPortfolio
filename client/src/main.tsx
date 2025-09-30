// client/src/main.tsx
import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@/styles/tokens.css"; // <-- use alias so Vite resolves it consistently

import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import App from "./App";

createRoot(document.getElementById("root")!).render(
  <Router hook={useHashLocation}>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </Router>
);
