import { forwardRef } from "react";
import {
  type ConteudoEsboco,
  type LeadEsboco,
  type PaletaEsboco,
  telefoneExibicao,
  whatsappLink,
} from "./esbocoSite";

interface Props {
  lead: LeadEsboco;
  conteudo: ConteudoEsboco;
  paleta: PaletaEsboco;
  /** Contato do vendedor exibido na última página (proposta comercial). */
  contatoVendedor?: { nome?: string; whatsapp?: string; valor?: string };
}

const LARGURA = 1000;

/**
 * Mockup do site do cliente. As cores são inline de propósito: este bloco é
 * conteúdo gerado (arte da proposta), não UI do aplicativo.
 */
export const EsbocoSitePreview = forwardRef<HTMLDivElement, Props>(function EsbocoSitePreview(
  { lead, conteudo, paleta, contatoVendedor },
  ref,
) {
  const wa = whatsappLink(lead);
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const botao = {
    display: "inline-block",
    background: paleta.primaria,
    color: "#fff",
    padding: "14px 28px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 16,
  } as const;

  const tituloSecao = {
    fontFamily: paleta.fonteTitulo,
    color: paleta.secundaria,
    fontSize: 34,
    fontWeight: 700,
    margin: 0,
  } as const;

  const card = {
    background: "#fff",
    border: `1px solid ${paleta.destaque}`,
    borderRadius: 16,
    padding: 24,
  } as const;

  return (
    <div
      ref={ref}
      style={{
        width: LARGURA,
        background: paleta.fundo,
        color: paleta.texto,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        lineHeight: 1.55,
      }}
    >
      {/* ---------- CAPA ---------- */}
      <section
        style={{
          height: 1380,
          background: `linear-gradient(160deg, ${paleta.secundaria} 0%, ${paleta.primaria} 100%)`,
          color: "#fff",
          padding: 72,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: 3, textTransform: "uppercase", opacity: 0.85 }}>
          Proposta de site profissional
        </div>
        <div>
          <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 12 }}>{conteudo.categoria} · {conteudo.cidade}</div>
          <h1 style={{ fontFamily: paleta.fonteTitulo, fontSize: 64, lineHeight: 1.1, margin: 0 }}>{lead.nome}</h1>
          <p style={{ fontSize: 20, maxWidth: 620, marginTop: 24, opacity: 0.92 }}>
            Um esboço de como o seu site ficaria: estrutura, seções e visual pensados para transformar visitantes em
            clientes no WhatsApp.
          </p>
          <div style={{ marginTop: 40, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(255,255,255,.16)", padding: "8px 16px", borderRadius: 999, fontSize: 14 }}>
              {conteudo.notaTexto}
            </span>
            <span style={{ background: "rgba(255,255,255,.16)", padding: "8px 16px", borderRadius: 999, fontSize: 14 }}>
              Site responsivo · SEO local
            </span>
          </div>
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Gerado em {hoje} · Esboço ilustrativo — textos e imagens são ajustados na produção final.
        </div>
      </section>

      {/* ---------- HEADER DO SITE ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 48px",
          borderBottom: `1px solid ${paleta.destaque}`,
          background: "#fff",
        }}
      >
        <div style={{ fontFamily: paleta.fonteTitulo, fontWeight: 700, fontSize: 22, color: paleta.secundaria }}>
          {lead.nome}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 14, color: paleta.textoSuave }}>
          <span>Início</span>
          <span>Serviços</span>
          <span>Sobre</span>
          <span>Depoimentos</span>
          <span>Contato</span>
          <span style={{ ...botao, padding: "10px 20px", fontSize: 14 }}>WhatsApp</span>
        </div>
      </div>

      {/* ---------- HERO ---------- */}
      <section style={{ display: "flex", gap: 40, padding: "64px 48px", background: paleta.fundoAlt }}>
        <div style={{ flex: 1.1 }}>
          <div
            style={{
              display: "inline-block",
              background: paleta.destaque,
              color: paleta.secundaria,
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {conteudo.notaTexto}
          </div>
          <h2 style={{ ...tituloSecao, fontSize: 46, marginTop: 20 }}>{conteudo.heroTitulo}</h2>
          <p style={{ color: paleta.textoSuave, fontSize: 18, marginTop: 18 }}>{conteudo.heroSubtitulo}</p>
          <div style={{ marginTop: 28, display: "flex", gap: 14, alignItems: "center" }}>
            <span style={botao}>{conteudo.ctaPrincipal}</span>
            <span style={{ fontSize: 15, color: paleta.textoSuave }}>{telefoneExibicao(lead)}</span>
          </div>
        </div>
        <div
          style={{
            flex: 0.9,
            minHeight: 320,
            borderRadius: 20,
            background: `repeating-linear-gradient(45deg, ${paleta.destaque}, ${paleta.destaque} 12px, ${paleta.fundo} 12px, ${paleta.fundo} 24px)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: paleta.secundaria,
            fontSize: 15,
            fontWeight: 600,
            textAlign: "center",
            padding: 20,
          }}
        >
          [FOTO PRINCIPAL]
          <br />
          espaço para foto real do
          <br />
          atendimento / equipe
        </div>
      </section>

      {/* ---------- SERVIÇOS ---------- */}
      <section style={{ padding: "64px 48px" }}>
        <h3 style={tituloSecao}>O que oferecemos</h3>
        <p style={{ color: paleta.textoSuave, fontSize: 17, marginTop: 10, maxWidth: 640 }}>
          Serviços apresentados de forma clara, do jeito que o cliente procura no Google.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 32 }}>
          {conteudo.servicos.map((s, i) => (
            <div key={i} style={{ ...card, width: 436 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: paleta.destaque,
                  color: paleta.secundaria,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  marginBottom: 14,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontWeight: 700, fontSize: 19, color: paleta.secundaria }}>{s.titulo}</div>
              <p style={{ color: paleta.textoSuave, fontSize: 15, marginTop: 8, marginBottom: 0 }}>{s.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- SOBRE ---------- */}
      <section style={{ display: "flex", gap: 40, padding: "64px 48px", background: paleta.fundoAlt }}>
        <div
          style={{
            width: 320,
            minHeight: 280,
            borderRadius: 20,
            border: `2px dashed ${paleta.primaria}`,
            color: paleta.primaria,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 600,
            textAlign: "center",
            padding: 16,
          }}
        >
          [FOTO DO PROFISSIONAL]
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={tituloSecao}>{conteudo.sobreTitulo}</h3>
          <p style={{ color: paleta.textoSuave, fontSize: 17, marginTop: 16 }}>{conteudo.sobreTexto}</p>
          <div style={{ display: "flex", gap: 32, marginTop: 26 }}>
            {[
              { n: conteudo.notaTexto.split(" ")[0], l: "Nota no Google" },
              { n: lead.total_avaliacoes ? String(lead.total_avaliacoes) : "—", l: "Avaliações" },
              { n: "100%", l: "Atendimento pelo WhatsApp" },
            ].map((k, i) => (
              <div key={i}>
                <div style={{ fontFamily: paleta.fonteTitulo, fontSize: 30, color: paleta.primaria, fontWeight: 700 }}>
                  {k.n}
                </div>
                <div style={{ fontSize: 13, color: paleta.textoSuave }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- COMO FUNCIONA ---------- */}
      <section style={{ padding: "64px 48px" }}>
        <h3 style={tituloSecao}>Como funciona</h3>
        <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
          {conteudo.passos.map((p, i) => (
            <div key={i} style={{ ...card, flex: 1, background: paleta.fundoAlt }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: paleta.secundaria }}>{p.titulo}</div>
              <p style={{ color: paleta.textoSuave, fontSize: 15, marginTop: 8, marginBottom: 0 }}>{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- PROVA SOCIAL ---------- */}
      <section style={{ padding: "64px 48px", background: paleta.secundaria, color: "#fff" }}>
        <h3 style={{ ...tituloSecao, color: "#fff" }}>Quem já foi atendido</h3>
        <p style={{ opacity: 0.85, marginTop: 10, fontSize: 16 }}>{conteudo.notaTexto}</p>
        <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
          {conteudo.depoimentos.map((d, i) => (
            <div
              key={i}
              style={{ flex: 1, background: "rgba(255,255,255,.10)", borderRadius: 16, padding: 22, fontSize: 15 }}
            >
              <div style={{ color: paleta.destaque, fontSize: 18, marginBottom: 8 }}>★★★★★</div>
              <p style={{ margin: 0, opacity: 0.94 }}>{d.texto}</p>
              <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>{d.nome}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section style={{ padding: "64px 48px" }}>
        <h3 style={tituloSecao}>Perguntas frequentes</h3>
        <div style={{ marginTop: 26 }}>
          {conteudo.faq.map((f, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${paleta.destaque}`, padding: "18px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: paleta.secundaria }}>{f.p}</div>
              <p style={{ color: paleta.textoSuave, fontSize: 15, marginTop: 6, marginBottom: 0 }}>{f.r}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CONTATO ---------- */}
      <section style={{ display: "flex", gap: 40, padding: "64px 48px", background: paleta.fundoAlt }}>
        <div style={{ flex: 1 }}>
          <h3 style={tituloSecao}>Onde nos encontrar</h3>
          <div style={{ marginTop: 20, fontSize: 16, color: paleta.textoSuave }}>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ color: paleta.texto }}>Endereço:</strong> {lead.endereco ?? "[EDITAR: endereço]"}
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ color: paleta.texto }}>WhatsApp:</strong> {telefoneExibicao(lead)}
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ color: paleta.texto }}>Horário:</strong> Seg a sex, 08h às 18h · Sáb, 08h às 12h
            </div>
          </div>
          <div style={{ marginTop: 26 }}>
            <span style={botao}>{conteudo.ctaPrincipal}</span>
          </div>
        </div>
        <div
          style={{
            width: 400,
            minHeight: 240,
            borderRadius: 16,
            background: paleta.destaque,
            color: paleta.secundaria,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          [MAPA DO GOOGLE]
        </div>
      </section>

      {/* ---------- RODAPÉ DO SITE ---------- */}
      <div
        style={{
          padding: "28px 48px",
          background: paleta.secundaria,
          color: "#fff",
          fontSize: 13,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>© {new Date().getFullYear()} {lead.nome} — Todos os direitos reservados</span>
        <span style={{ opacity: 0.75 }}>{wa ? "Botão flutuante de WhatsApp em todas as telas" : "[EDITAR: WhatsApp]"}</span>
      </div>

      {/* ---------- PÁGINA FINAL: COMO CONTRATAR ---------- */}
      <section style={{ padding: 64, background: "#fff" }}>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: paleta.primaria }}>
          Próximo passo
        </div>
        <h3 style={{ ...tituloSecao, marginTop: 12 }}>Como contratar o site da {lead.nome}</h3>
        <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
          {[
            { t: "Aprovação do esboço", d: "Você confirma a estrutura e o visual apresentados neste documento." },
            { t: "Envio do conteúdo", d: "Fotos reais, textos institucionais, horários e redes sociais." },
            { t: "Site publicado", d: "Site no ar com domínio, responsivo, SEO local e WhatsApp integrado." },
          ].map((p, i) => (
            <div key={i} style={{ ...card, flex: 1, background: paleta.fundoAlt }}>
              <div style={{ fontWeight: 700, color: paleta.secundaria, fontSize: 17 }}>{i + 1}. {p.t}</div>
              <p style={{ color: paleta.textoSuave, fontSize: 15, marginTop: 8, marginBottom: 0 }}>{p.d}</p>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 32,
            padding: 28,
            borderRadius: 18,
            background: paleta.destaque,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div>
            <div style={{ fontFamily: paleta.fonteTitulo, fontSize: 26, color: paleta.secundaria, fontWeight: 700 }}>
              Investimento: {contatoVendedor?.valor || "R$ 500,00"}
            </div>
            <div style={{ fontSize: 14, color: paleta.textoSuave, marginTop: 6 }}>
              Site completo, publicado e pronto para receber clientes.
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 14, color: paleta.secundaria }}>
            <div style={{ fontWeight: 700 }}>{contatoVendedor?.nome || "[SEU NOME]"}</div>
            <div>{contatoVendedor?.whatsapp || "[SEU WHATSAPP]"}</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: paleta.textoSuave, marginTop: 24 }}>
          Este documento é um esboço ilustrativo criado a partir de informações públicas do Google Maps. Textos, imagens
          e depoimentos são substituídos por conteúdo real na produção do site.
        </p>
      </section>
    </div>
  );
});
