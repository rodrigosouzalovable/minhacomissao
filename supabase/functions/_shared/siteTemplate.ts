// Template do site institucional gerado (HTML server-side, meta tag no código-fonte).

export interface SiteData {
  cnpj: string;
  razao_social: string;
  nome_site?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  cnae?: string | null;
  abertura?: string | null;
  sobre?: string | null;
  foto_url?: string | null;
  meta_verification?: string | null;
  url: string;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const soDigitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "");

const formatCnpj = (v: string) => {
  const d = soDigitos(v);
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const formatTelefone = (v?: string | null) => {
  const d = soDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? "";
};

export function gerarHtmlSite(d: SiteData): string {
  const nome = d.nome_site?.trim() || d.razao_social;
  const cnpjFmt = formatCnpj(d.cnpj);
  const cnpjNum = soDigitos(d.cnpj);
  const telDigits = soDigitos(d.telefone);
  const wa = telDigits ? `https://wa.me/55${telDigits}` : null;
  const cidadeUf = [d.cidade, d.uf].filter(Boolean).join(" / ");
  const enderecoLinha = [d.endereco, d.bairro].filter(Boolean).join(", ");
  const ano = new Date().getFullYear();
  const sobre =
    d.sobre?.trim() ||
    `${d.razao_social} é uma empresa brasileira devidamente registrada sob o CNPJ ${cnpjFmt}${
      d.cidade ? `, com sede em ${d.cidade}` : ""
    }. Atuamos com transparência, ética e compromisso com cada cliente, entregando serviços de qualidade e atendimento próximo.`;
  const descricao = `${d.razao_social} — empresa brasileira registrada sob o CNPJ ${cnpjFmt}${
    d.cidade ? `, sediada em ${d.cidade}` : ""
  }. ${d.cnae ? `Atividade principal: ${d.cnae}. ` : ""}Fale com a nossa equipe.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: nome,
    legalName: d.razao_social,
    description: sobre,
    url: d.url,
    taxID: cnpjNum,
    ...(d.abertura ? { foundingDate: d.abertura } : {}),
    ...(d.telefone ? { telephone: `+55${telDigits}` } : {}),
    ...(d.email ? { email: d.email } : {}),
    ...(d.foto_url ? { image: d.foto_url } : {}),
    identifier: [{ "@type": "PropertyValue", name: "CNPJ", value: cnpjNum }],
    address: {
      "@type": "PostalAddress",
      streetAddress: enderecoLinha || undefined,
      addressLocality: d.cidade || undefined,
      addressRegion: d.uf || undefined,
      postalCode: soDigitos(d.cep) || undefined,
      addressCountry: "BR",
    },
    areaServed: cidadeUf || "Brasil",
  };

  return `<!DOCTYPE html>
<html lang="pt-BR" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${d.meta_verification ? `<meta name="facebook-domain-verification" content="${esc(d.meta_verification)}" />` : ""}
<title>${esc(nome)} — Empresa Verificada | CNPJ ${esc(cnpjFmt)}</title>
<meta name="description" content="${esc(descricao).slice(0, 300)}">
<meta name="author" content="${esc(d.razao_social)}">
<meta name="robots" content="index, follow">
<meta name="language" content="pt-BR">
<link rel="canonical" href="${esc(d.url)}">
<meta property="og:type" content="business.business">
<meta property="og:site_name" content="${esc(nome)}">
<meta property="og:title" content="${esc(nome)} — Empresa Verificada">
<meta property="og:description" content="${esc(descricao).slice(0, 200)}">
<meta property="og:url" content="${esc(d.url)}">
<meta property="og:locale" content="pt_BR">
${d.foto_url ? `<meta property="og:image" content="${esc(d.foto_url)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(nome)} — Empresa Verificada">
<meta name="twitter:description" content="${esc(descricao).slice(0, 200)}">
${enderecoLinha ? `<meta property="business:contact_data:street_address" content="${esc(enderecoLinha)}">` : ""}
${d.cidade ? `<meta property="business:contact_data:locality" content="${esc(d.cidade)}">` : ""}
${d.uf ? `<meta property="business:contact_data:region" content="${esc(d.uf)}">` : ""}
${d.cep ? `<meta property="business:contact_data:postal_code" content="${esc(d.cep)}">` : ""}
<meta property="business:contact_data:country_name" content="Brazil">
${telDigits ? `<meta property="business:contact_data:phone_number" content="+55${telDigits}">` : ""}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--ink:#0d1b2a;--ink-soft:#48576b;--line:#e3e8ef;--bg:#f6f8fb;--brand:#0f5c4a;--brand-soft:#e7f3ef;--accent:#c9a227}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:Sora,Inter,sans-serif;line-height:1.2}
a{color:inherit}
.wrap{max-width:1060px;margin:0 auto;padding:0 24px}
header.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:10}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;height:72px}
.brand{display:flex;align-items:center;gap:12px;font-weight:600}
.mark{width:40px;height:40px;border-radius:10px;background:var(--brand);color:#fff;display:grid;place-items:center;font-family:Sora;font-weight:700}
.brand small{display:block;color:var(--ink-soft);font-weight:400;font-size:12px}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--brand);color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px}
.btn.ghost{background:#fff;color:var(--brand);border:1px solid var(--brand)}
.hero{background:linear-gradient(180deg,#0d1b2a 0%,#12324a 100%);color:#fff;padding:76px 0 88px}
.badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);color:#fff;padding:6px 14px;border-radius:999px;font-size:12.5px;letter-spacing:.02em;text-transform:uppercase}
.hero h1{font-size:clamp(30px,5vw,46px);margin:18px 0 14px}
.hero p{color:#cfdcea;max-width:680px;font-size:17px}
.hero .acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
section{padding:64px 0}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px}
.card .k{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft);font-weight:600}
.card .v{font-size:17px;font-weight:600;margin-top:6px;word-break:break-word}
h2{font-size:26px;margin-bottom:8px}
.lead{color:var(--ink-soft);margin-bottom:26px;max-width:720px}
.split{display:grid;gap:26px;grid-template-columns:1.2fr .8fr;align-items:start}
.pill{display:inline-block;background:var(--brand-soft);color:var(--brand);font-weight:600;font-size:13px;padding:5px 12px;border-radius:999px;margin:0 6px 6px 0}
.photo{width:100%;border-radius:16px;border:1px solid var(--line);display:block}
footer{background:#0d1b2a;color:#9fb2c6;padding:40px 0;font-size:14px}
footer strong{color:#fff;display:block;margin-bottom:6px;font-family:Sora}
@media(max-width:760px){.split{grid-template-columns:1fr}section{padding:46px 0}}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <div class="brand"><span class="mark">${esc(nome.trim().charAt(0).toUpperCase() || "E")}</span>
    <span>${esc(nome)}<small>CNPJ ${esc(cnpjFmt)}</small></span></div>
  ${wa ? `<a class="btn" href="${esc(wa)}" rel="noopener">Falar no WhatsApp</a>` : ""}
</div></header>

<div class="hero"><div class="wrap">
  <span class="badge">Empresa verificada${cidadeUf ? ` &middot; ${esc(cidadeUf)}` : ""}</span>
  <h1>${esc(nome)}</h1>
  <p>${esc(sobre)}</p>
  <div class="acts">
    ${wa ? `<a class="btn" href="${esc(wa)}" rel="noopener">Falar no WhatsApp</a>` : ""}
    ${d.email ? `<a class="btn ghost" href="mailto:${esc(d.email)}">Enviar e-mail</a>` : ""}
  </div>
</div></div>

<section><div class="wrap">
  <h2>Dados oficiais</h2>
  <p class="lead">Informações cadastrais públicas da empresa, conforme registro na Receita Federal.</p>
  <div class="grid">
    <div class="card"><div class="k">Razão social</div><div class="v">${esc(d.razao_social)}</div></div>
    <div class="card"><div class="k">CNPJ</div><div class="v">${esc(cnpjFmt)}</div></div>
    ${d.abertura ? `<div class="card"><div class="k">Em atividade desde</div><div class="v">${esc(d.abertura)}</div></div>` : ""}
    ${d.cnae ? `<div class="card"><div class="k">Atividade principal</div><div class="v">${esc(d.cnae)}</div></div>` : ""}
  </div>
</div></section>

<section style="background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line)"><div class="wrap split">
  <div>
    <h2>Sobre a empresa</h2>
    <p class="lead">${esc(sobre)}</p>
    <div>
      <span class="pill">Atendimento humano</span>
      <span class="pill">Empresa registrada</span>
      <span class="pill">Transparência</span>
      ${cidadeUf ? `<span class="pill">${esc(cidadeUf)}</span>` : ""}
    </div>
  </div>
  ${d.foto_url ? `<img class="photo" src="${esc(d.foto_url)}" alt="${esc(nome)}" loading="lazy">` : `<div class="card"><div class="k">Compromisso</div><div class="v">Qualidade, ética e responsabilidade em cada atendimento.</div></div>`}
</div></section>

<section><div class="wrap">
  <h2>Contato</h2>
  <p class="lead">Fale com a nossa equipe pelos canais oficiais.</p>
  <div class="grid">
    ${d.telefone ? `<div class="card"><div class="k">Telefone / WhatsApp</div><div class="v"><a href="${esc(wa || "#")}" rel="noopener">${esc(formatTelefone(d.telefone))}</a></div></div>` : ""}
    ${d.email ? `<div class="card"><div class="k">E-mail</div><div class="v"><a href="mailto:${esc(d.email)}">${esc(d.email)}</a></div></div>` : ""}
    ${enderecoLinha || cidadeUf ? `<div class="card"><div class="k">Endereço</div><div class="v">${esc([enderecoLinha, cidadeUf, d.cep].filter(Boolean).join(" — "))}</div></div>` : ""}
  </div>
</div></section>

<footer><div class="wrap">
  <strong>${esc(nome)}</strong>
  CNPJ ${esc(cnpjFmt)}${enderecoLinha ? ` &middot; ${esc(enderecoLinha)}` : ""}${cidadeUf ? ` &middot; ${esc(cidadeUf)}` : ""}<br>
  &copy; ${ano} ${esc(d.razao_social)}. Todos os direitos reservados.
</div></footer>
</body>
</html>`;
}
