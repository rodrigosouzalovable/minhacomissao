/** Monta o prompt para criar na Lovable o site de uma empresa da caixa USA B2B. */
export type DadosSite = {
  nome: string; telefone: string; cidade?: string; nicho?: string;
  servicos?: string; diferenciais?: string; idioma?: 'en' | 'pt' | 'bilingue'; observacoes?: string;
};

export function formatarTelefoneUsa(t: string): string {
  const d = String(t || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : t;
}

export function limparNicho(n?: string): string {
  return String(n || 'local business').replace(/\bbrazilian\b/gi, '').replace(/\s+/g, ' ').trim() || 'local business';
}

export function gerarPromptSite(d: DadosSite): string {
  const tel = formatarTelefoneUsa(d.telefone);
  const wa = String(d.telefone || '').replace(/\D/g, '');
  const nicho = limparNicho(d.nicho);
  const local = d.cidade?.trim() || 'their local area';
  const idioma = d.idioma === 'pt' ? 'Brazilian Portuguese' : d.idioma === 'bilingue' ? 'English with a visible EN/PT language toggle (full Brazilian Portuguese version)' : 'American English';
  const servicos = d.servicos?.trim()
    ? d.servicos.split(/\n|,|;/).map((s) => s.trim()).filter(Boolean).map((s) => `   - ${s}`).join('\n')
    : `   - Infer the 6 most profitable, realistic services a top-rated ${nicho} in ${local} offers, each with a one-line benefit and a fitting icon.`;
  return `Build a stunning, premium, conversion-focused one-page website for "${d.nome}", a ${nicho} serving ${local}. The owner must open it and say "WOW". It must look like a $3,000 custom agency site, never a template.

BUSINESS DATA (use exactly):
- Business name: ${d.nome}
- Category: ${nicho}
- Location / service area: ${local} and surrounding towns
- Phone: ${tel}
- WhatsApp: https://wa.me/${wa}
- Language: ${idioma}
${d.diferenciais?.trim() ? `- Differentiators: ${d.diferenciais.trim()}\n` : ''}${d.observacoes?.trim() ? `- Owner notes: ${d.observacoes.trim()}\n` : ''}
DESIGN DIRECTION:
- Pick a bold, distinctive art direction that fits a ${nicho} (premium palette with one confident accent color, strong editorial typography from Google Fonts, never Inter/Poppins, never purple gradients).
- Generous whitespace, large imagery, subtle scroll-reveal animations, smooth hover states, crisp shadows. Flawless on mobile first (most visitors come from Google on their phone).
- Generate high-quality realistic photos for the hero, services and gallery that match a ${nicho} in ${local}.

SECTIONS:
1. Sticky header: logo wordmark "${d.nome}", nav (Services, Work, Reviews, Area, Contact), "Call ${tel}" button.
2. Hero: powerful headline about the result customers get, short subheadline mentioning ${local}, two CTAs ("Get a Free Estimate" and "WhatsApp Us"), trust badges (Licensed & Insured, 5-Star Rated, Free Estimates, Satisfaction Guaranteed).
3. Trust bar with animated counters (years of experience, projects completed, 5.0 Google rating).
4. Services grid:
${servicos}
5. Interactive before/after image slider (draggable) showing a dramatic transformation.
6. "How it works" in 4 simple steps, ending with the customer's satisfaction.
7. Gallery / recent work with a lightbox.
8. Reviews: 3 realistic 5-star testimonials from local customers with first names and towns (mark clearly as sample reviews to be replaced).
9. Service area: list of towns around ${local} plus an embedded Google Map of ${local}.
10. Free-estimate form (name, phone, service, message) with a friendly success state, plus a big FAQ accordion (6 questions).
11. Final CTA band and footer with phone, WhatsApp, service area and "© ${new Date().getFullYear()} ${d.nome}".
12. Floating WhatsApp button (bottom-right) linking to https://wa.me/${wa}, and a sticky "Call now" bar on mobile.

QUALITY RULES:
- SEO: title, meta description and LocalBusiness JSON-LD with the name, phone and area above.
- Fast, accessible (contrast, alt text), all buttons working (tel: and WhatsApp links).
- Do not invent prices, licenses numbers or awards; keep copy confident, specific and benefit-driven.`;
}
