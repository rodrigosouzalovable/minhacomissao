import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Redireciona links de botões dinâmicos da Meta no formato
// https://meusacordos.com.br/https://destino.com/... para o destino informado.
const redirecionamentoExterno = (() => {
  const resto = (window.location.pathname + window.location.search + window.location.hash).replace(/^\/+/, "");
  const m = resto.match(/^(https?):\/+(.+)$/i);
  if (!m) return null;
  try {
    const url = new URL(`${m[1].toLowerCase()}://${m[2]}`);
    return url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
})();

if (redirecionamentoExterno) {
  window.location.replace(redirecionamentoExterno);
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
