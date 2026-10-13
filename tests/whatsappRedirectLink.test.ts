import { describe, expect, it } from "vitest";
import { montarLinkWhatsappRedirect } from "../src/lib/whatsappRedirectLink";
import { resolveMetaButtonRedirect } from "../src/lib/metaButtonRedirect";

describe("gerador de link WhatsApp", () => {
  it("monta o link do Meus Acordos com número 55 e mensagem codificada", () => {
    expect(montarLinkWhatsappRedirect("(62) 98181-0202", "Olá! Tenho interesse")).toBe(
      "https://meusacordos.com.br/https://wa.me/5562981810202?text=Ol%C3%A1!%20Tenho%20interesse",
    );
  });
  it("rejeita telefone incompleto", () => {
    expect(montarLinkWhatsappRedirect("8181-0202", "Oi")).toBeNull();
  });
  it("o redirecionamento abre exatamente o WhatsApp gerado", () => {
    const link = montarLinkWhatsappRedirect("62981810202", "Olá, redução das parcelas")!;
    const u = new URL(link);
    expect(resolveMetaButtonRedirect(u.pathname + u.search)).toBe(
      "https://wa.me/5562981810202?text=Ol%C3%A1%2C%20redu%C3%A7%C3%A3o%20das%20parcelas",
    );
  });
});
