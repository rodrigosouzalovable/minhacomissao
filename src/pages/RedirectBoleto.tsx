import { useEffect } from "react";

const WHATSAPP_URL =
  "https://wa.me/5562982183144?text=" +
  encodeURIComponent("Olá! Recebi uma mensagem e quero solicitar meu boleto para pagamento.");

export default function RedirectBoleto() {
  useEffect(() => {
    window.location.replace(WHATSAPP_URL);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: 24,
      textAlign: "center",
    }}>
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Abrindo WhatsApp...</h1>
        <p style={{ marginBottom: 16, color: "#555" }}>
          Se o WhatsApp não abrir automaticamente, toque no botão abaixo.
        </p>
        <a
          href={WHATSAPP_URL}
          style={{
            display: "inline-block",
            background: "#25D366",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Abrir WhatsApp
        </a>
      </div>
    </div>
  );
}
