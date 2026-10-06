import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { resolveMetaButtonRedirect } from "./lib/metaButtonRedirect";

// Redireciona links de botões dinâmicos da Meta no formato
// https://meusacordos.com.br/https://destino.com/... para o destino informado.
const redirecionamentoExterno = resolveMetaButtonRedirect(
  window.location.pathname + window.location.search + window.location.hash,
);

if (redirecionamentoExterno) {
  window.location.replace(redirecionamentoExterno);
} else {
  const root = document.getElementById("root");
  if (root) createRoot(root).render(<App />);
}
