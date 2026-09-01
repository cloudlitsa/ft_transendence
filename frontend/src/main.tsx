import "./index.css";
import React from "react"; 
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ToastProvider } from "./components/ToastProvider.tsx";
import { AuthProvider } from "./lib/AuthContext.tsx";

import { AlertsProvider } from "./lib/AlertsContext.tsx";
import { PresenceProvider } from "./lib/PresenceContext.tsx";
import { MessagesProvider } from "./lib/MessagesContext.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* <BrowserRouter> enables URL type navigation for the whole app*/}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <PresenceProvider>
            <AlertsProvider>
              <MessagesProvider>
                <App />
              </MessagesProvider>
            </AlertsProvider>
          </PresenceProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
