import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";

// ✅ use named import for the hook
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

createRoot(document.getElementById("root")!).render(
  <Router hook={useHashLocation}>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </Router>
);
