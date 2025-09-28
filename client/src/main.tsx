import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Firebase auth provider
import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";

// ⬇️ add HashRouter (prevents server 404s on deep links)
import { HashRouter } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <FirebaseAuthProvider>
      <App />
    </FirebaseAuthProvider>
  </HashRouter>
);
