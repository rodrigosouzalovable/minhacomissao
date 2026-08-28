import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const REDES_SOCIAIS = [
  "instagram.com", "facebook.com", "fb.com", "linktr.ee", "linktree", "wa.me",
  "api.whatsapp.com", "linkedin.com", "tiktok.com", "youtube.com", "twitter.com", "x.com", "bit.ly",
];

interface Body {
  busca_id: string;
  limite_sites?: number;
  estilo?: string;
  lead_alvo_id?: string | null;
}

function ehSiteProprio(site: string | null) {
  const url = (site ?? "").trim().toLowerCase();
  if (!url) return false;
  return !REDES_SOCIAIS.some((d) => url.includes(d));
}

function extrairConteudo(html: string) {
  const pega = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].replace(/\s+/g, " ").trim() : null;
  };
  const titulo = pega(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descricao = pega(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    ?? pega(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  const headings: string[] = [];
  for (const m of html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const txt = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (txt && txt.length < 160) headings.push(`H${m[1]}: ${txt}`);
    if (headings.length >= 40) break;
  }

  const botoes: string[] = [];
  for (const m of html.matchAll(/<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)) {
    const txt = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (txt && txt.length > 2 && txt.length < 60) botoes.push(txt);
    if (botoes.length >= 60) break;
  }

  const cores = Array.from(new Set(
    Array.from(html.matchAll(/#[0-9a-fA-F]{6}\b/g)).map((m) => m[0].toLowerCase()),
  )).slice(0, 20);

  const fontes = Array.from(new Set(
    Array.from(html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([A-Za-z0-9+%]+)/g))
      .map((m) => decodeURIComponent(m[1].replace(/\+/g, " ")).split(":")[0]),
  )).slice(0, 6);

  const texto = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  const integracoes: string[] = [];
  if (/wa\.me|api\.whatsapp\.com|whatsapp/i.test(html)) integracoes.push("WhatsApp");
  if (/instagram\.com/i.test(html)) integracoes.push("Instagram");
  if (/calendly|agendamento|agendar|booking|doctoralia/i.test(html)) integracoes.push("Agendamento online");
  if (/mercadopago|stripe|pagseguro|checkout/i.test(html)) integracoes.push("Pagamento online");
  if (/wp-content|wordpress/i.test(html)) integracoes.push("WordPress");

  return { titulo, descricao, headings, botoes: Array.from(new Set(botoes)), cores, fontes, integracoes, texto };
}

async function lerSite(url: string) {
  const alvo = url.startsWith("http") ? url : `https://${url}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const resp = await fetch(alvo, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadSiteAnalyzer/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    if (!html || html.length < 200) return null;
    return extrairConteudo(html);
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Configuração do backend ausente");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    if (!body?.busca_id) {
      return new Response(JSON.stringify({ error: "busca_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const limiteSites = Math.min(Math.max(body.limite_sites ?? 8, 2), 15);
    const estilo = (body.estilo ?? "moderno").trim();

    const { data: busca, error: buscaErr } = await supabase
      .from("google_maps_buscas")
      .select("id, categoria, localizacao")
      .eq("id", body.busca_id)
      .maybeSingle();
    if (buscaErr) throw buscaErr;
    if (!busca) {
      return new Response(JSON.stringify({ error: "Busca não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: leads, error: leadsErr } = await supabase
      .from("google_maps_leads")
      .select("id, nome, site, avaliacao, total_avaliacoes, endereco, categoria, telefone, telefone_internacional")
      .eq("busca_id", body.busca_id);
    if (leadsErr) throw leadsErr;

    const comSite = (leads ?? [])
      .filter((l) => ehSiteProprio(l.site))
      .sort((a, b) => (b.total_avaliacoes ?? 0) - (a.total_avaliacoes ?? 0))
      .slice(0, limiteSites);

    if (comSite.length === 0) {
      return new Response(
        JSON.stringify({ error: "sem_sites", message: "Nenhum lead desta busca tem site próprio para analisar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lidos: Array<{ nome: string; site: string; dados: ReturnType<typeof extrairConteudo> }> = [];
    let falharam = 0;
    const resultados = await Promise.all(comSite.map(async (l) => ({ l, dados: await lerSite(l.site as string) })));
    for (const r of resultados) {
      if (r.dados) lidos.push({ nome: r.l.nome, site: r.l.site as string, dados: r.dados });
      else falharam++;
    }

    if (lidos.length === 0) {
      return new Response(
        JSON.stringify({ error: "leitura_falhou", message: "Não foi possível ler nenhum dos sites (bloqueio ou timeout). Tente outra busca." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let alvo: Record<string, unknown> | null = null;
    if (body.lead_alvo_id) {
      alvo = (leads ?? []).find((l) => l.id === body.lead_alvo_id) ?? null;
    }

    const material = lidos.map((s, i) => `--- SITE ${i + 1}: ${s.nome} (${s.site}) ---
Título: ${s.dados.titulo ?? "-"}
Meta descrição: ${s.dados.descricao ?? "-"}
Cabeçalhos: ${s.dados.headings.slice(0, 25).join(" | ")}
Botões/links: ${s.dados.botoes.slice(0, 25).join(" | ")}
Cores encontradas: ${s.dados.cores.join(", ") || "-"}
Fontes: ${s.dados.fontes.join(", ") || "-"}
Integrações: ${s.dados.integracoes.join(", ") || "-"}
Texto: ${s.dados.texto.slice(0, 1800)}`).join("\n\n");

    const systemPrompt = `Você é um especialista em web design e conversão para pequenos negócios brasileiros.
Recebe o conteúdo real de vários sites de concorrentes do mesmo nicho e cidade.
Sua tarefa: identificar o padrão do nicho e escrever um PROMPT pronto para colar em uma IA de geração de sites (Lovable/Claude), em português do Brasil.
Regras:
- Baseie-se apenas no material recebido; não invente números, prêmios, depoimentos ou certificações.
- O prompt final deve ser autossuficiente, detalhado e conter: contexto do negócio, público, objetivo de conversão, estrutura de seções na ordem recomendada, referências de layout/paleta (hex)/tipografia, textos-base em português (placeholders quando faltar dado real), requisitos técnicos (HTML único com Tailwind via CDN, responsivo, SEO básico com title e meta description, botão flutuante de WhatsApp, performance) e o que evitar.
- Estilo visual solicitado: ${estilo}.`;

    const contextoAlvo = alvo
      ? `\n\nEMPRESA ALVO (o site será apresentado para ela):
Nome: ${alvo.nome}
Categoria: ${alvo.categoria ?? busca.categoria}
Endereço: ${alvo.endereco ?? "-"}
Telefone: ${alvo.telefone_internacional ?? alvo.telefone ?? "-"}
Nota Google: ${alvo.avaliacao ?? "-"} (${alvo.total_avaliacoes ?? 0} avaliações)`
      : "";

    const userPrompt = `NICHO: ${busca.categoria} — LOCAL: ${busca.localizacao}
Sites analisados: ${lidos.length} (falharam: ${falharam})${contextoAlvo}

MATERIAL COLETADO:
${material}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "resultado_analise_nicho",
            description: "Resumo do nicho e prompt final para gerar o site",
            parameters: {
              type: "object",
              properties: {
                resumo_nicho: { type: "string", description: "Parágrafo curto explicando como são os sites desse nicho" },
                secoes_recomendadas: { type: "array", items: { type: "string" }, description: "Seções na ordem recomendada" },
                paleta: { type: "array", items: { type: "string" }, description: "Cores em hex sugeridas" },
                tipografia: { type: "string", description: "Fontes sugeridas" },
                tom: { type: "string", description: "Tom de voz predominante" },
                ctas: { type: "array", items: { type: "string" }, description: "Chamadas de ação mais usadas" },
                integracoes: { type: "array", items: { type: "string" }, description: "Integrações comuns no nicho" },
                faltas_comuns: { type: "array", items: { type: "string" }, description: "O que costuma faltar nos sites do nicho" },
                prompt_final: { type: "string", description: "Prompt completo pronto para colar no Lovable/Claude" },
              },
              required: ["resumo_nicho", "secoes_recomendadas", "prompt_final"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "resultado_analise_nicho" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI Gateway erro:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "limite_ia", message: "Muitas requisições de IA agora. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "creditos_ia", message: "Créditos de IA esgotados. Adicione créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "falha_ia", message: `Erro da IA (${aiResp.status})`, details: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("A IA não retornou dados estruturados");
    const resultado = JSON.parse(toolCall.function.arguments);

    const { data: salvo, error: salvoErr } = await supabase
      .from("google_maps_nicho_analises")
      .insert({
        busca_id: busca.id,
        user_id: user.id,
        categoria: busca.categoria,
        localizacao: busca.localizacao,
        estilo,
        sites_lidos: lidos.length,
        sites_falharam: falharam,
        lead_alvo_id: body.lead_alvo_id ?? null,
        resumo: {
          resumo_nicho: resultado.resumo_nicho,
          secoes_recomendadas: resultado.secoes_recomendadas ?? [],
          paleta: resultado.paleta ?? [],
          tipografia: resultado.tipografia ?? null,
          tom: resultado.tom ?? null,
          ctas: resultado.ctas ?? [],
          integracoes: resultado.integracoes ?? [],
          faltas_comuns: resultado.faltas_comuns ?? [],
          sites: lidos.map((s) => ({ nome: s.nome, site: s.site })),
        },
        prompt: resultado.prompt_final,
      })
      .select()
      .single();
    if (salvoErr) throw salvoErr;

    return new Response(JSON.stringify({ analise: salvo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-maps-analisar-nicho erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "erro_interno", message: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
