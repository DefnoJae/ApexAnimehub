import "./styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);

// We wrap it in a strict mode but remove any hydration conflicts
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
