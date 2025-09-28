import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";

// ✅ Correct import paths for wouter + hash location
import { Router } from "wouter";
import useHashLocation from "wouter/use-hash-location";

createRoot(document.getElementById("root")!).render(
  <Router hook={useHashLocation}>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </Router>
);
