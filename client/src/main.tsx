import "./initApiBase";
// client/src/main.tsx
import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css"; // we'll import tokens.css from here in the next step

import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";
import { AuthProvider } from "./auth/AuthProvider";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import App from "./App";

createRoot(document.getElementById("root")!).render(
  <Router hook={useHashLocation}>
    <FirebaseAuthProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </FirebaseAuthProvider>
  </Router>
);
