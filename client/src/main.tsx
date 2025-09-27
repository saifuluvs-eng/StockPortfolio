import "./lib/disableLocalWs";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ⬇️ wrap App with the provider that your hook expects
import { FirebaseAuthProvider } from "./hooks/useFirebaseAuth";

createRoot(document.getElementById("root")!).render(
  <FirebaseAuthProvider>
    <App />
  </FirebaseAuthProvider>
);
