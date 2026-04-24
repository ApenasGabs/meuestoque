import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { SessionBootstrap } from "./components/SessionBootstrap";
import { applyStoredPreferences } from "./hooks/usePreferences";
import { Analytics } from "@vercel/analytics/react"
applyStoredPreferences();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionBootstrap />
    <Analytics/>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
