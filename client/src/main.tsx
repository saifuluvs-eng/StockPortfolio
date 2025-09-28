import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// keep your auth provider
import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";

// ✅ use wouter with hash location so routes are `/#/...`
import { Router, useHashLocation } from "wouter";

createRoot(document.getElementById("root")!).render(
  <Router hook={useHashLocation}>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </Router>
);
