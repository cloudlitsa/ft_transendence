import React from "react"; 
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* <BrowserRouter> enables URL type navigation for the whole app*/}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
     <App />
    </BrowserRouter>
  </React.StrictMode>
);
