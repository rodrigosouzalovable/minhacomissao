// Gera a resposta da IA configurada por um cliente USA B2B (prompt em EN/ES/PT).
export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export function clienteUsaAtivo(cfg: { usa_b2b?: boolean; teste_ate?: string | null } | null): boolean {
  if (!cfg?.usa_b2b) return false;
  if (cfg.teste_ate && new Date(cfg.teste_ate).getTime() < Date.now()) return false;
  return true;
}

const IDIOMA: Record<string, string> = {
  auto: "Always reply in the same language the customer writes in (English, Spanish or Portuguese).",
  en: "Always reply in English.",
  es: "Responde siempre en español.",
  pt: "Responda sempre em português do Brasil.",
};

export async function gerarRespostaClienteUsa(prompt: string, idioma: string, historico: ChatMsg[]): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('IA não configurada');
  const system = `You are the WhatsApp virtual assistant of a business. The business owner wrote the instructions below (they may be in English, Spanish or Portuguese — understand them in any language). Follow them strictly. Be short, friendly and natural (1-3 sentences, WhatsApp style). Never invent prices, hours or services not in the instructions; if you don't know, say a team member will confirm. ${IDIOMA[idioma] || IDIOMA.auto}\n\n=== BUSINESS INSTRUCTIONS ===\n${prompt || '(no instructions yet — greet politely and say a team member will reply soon)'}`;
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-lite',
      messages: [{ role: 'system', content: system }, ...historico.slice(-12)],
    }),
  });
  if (r.status === 429) throw new Error('Muitas solicitações, tente em instantes.');
  if (r.status === 402) throw new Error('Créditos de IA esgotados.');
  if (!r.ok) throw new Error(`Falha da IA (${r.status})`);
  const d = await r.json();
  return String(d?.choices?.[0]?.message?.content || '').trim();
}
