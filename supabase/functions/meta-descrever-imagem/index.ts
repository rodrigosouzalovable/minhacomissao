import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Imagens de WhatsApp ficam bem abaixo disso; acima é print gigante/foto crua.
const MAX_BYTES = 5_000_000;
const MODELO_VISAO = "google/gemini-3.6-flash";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const CLASSES = ["comprovante", "documento", "divida", "irrelevante", "ilegivel"] as const;

const SYSTEM = [
  "Você analisa imagens enviadas por clientes em um atendimento de cobrança no WhatsApp (Brasil).",
  "Descreva de forma objetiva o que aparece na imagem, incluindo textos, valores, datas, nomes de bancos/empresas e números de referência que estiverem legíveis.",
  "Classifique a imagem em uma destas categorias:",
  '- "comprovante": comprovante de pagamento (Pix, TED, transferência, boleto pago, recibo).',
  '- "documento": documento pessoal, contrato, carteira de trabalho, laudo, print de cadastro.',
  '- "divida": print de dívida, boleto em aberto, cobrança, negativação, acordo, tela de app de cobrança.',
  '- "irrelevante": foto pessoal, meme, figurinha, mensagem de bom dia, paisagem, algo sem relação com cobrança.',
  '- "ilegivel": não é possível entender nada da imagem (muito escura, borrada, cortada).',
  'Responda SOMENTE com JSON: {"descricao":"...","classificacao":"comprovante|documento|divida|irrelevante|ilegivel"}',
  "A descrição deve ter no máximo 600 caracteres, em português do Brasil, sem inventar nada que não esteja visível.",
].join("\n");

function extrairJson(txt: string): any {
  const bruto = String(txt || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(bruto);
  } catch (_) {
    const m = bruto.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) { /* ignore */ }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const mensagemId = String((body as any)?.mensagem_id || "").trim();
    if (!mensagemId) return json({ error: "mensagem_id é obrigatório" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const chamadaInterna = token === serviceKey;
    const caller = chamadaInterna
      ? admin
      : createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });

    const { data: msg, error: msgErr } = await caller
      .from("meta_whatsapp_mensagens")
      .select("id, media_url, tipo_conteudo, conteudo")
      .eq("id", mensagemId)
      .maybeSingle();
    if (msgErr) return json({ error: msgErr.message }, 403);
    if (!msg) return json({ error: "mensagem não encontrada" }, 404);
    if (!(msg as any).media_url) return json({ error: "mensagem sem mídia" }, 422);

    const imgRes = await fetch((msg as any).media_url);
    if (!imgRes.ok) {
      console.error("[descrever-imagem] download falhou", imgRes.status);
      return json({ error: `imagem indisponível (${imgRes.status})` }, 410);
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.length === 0) return json({ error: "imagem vazia" }, 422);
    if (bytes.length > MAX_BYTES) {
      console.log("[descrever-imagem] imagem acima do limite", { bytes: bytes.length });
      return json({ error: "imagem muito grande", motivo: "muito_grande", bytes: bytes.length }, 413);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const mime = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0];
    const dataUrl = `data:${mime};base64,${toBase64(bytes)}`;
    const legenda = String((msg as any).conteudo || "").trim();

    const payload = {
      model: MODELO_VISAO,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: legenda && !/^\[imagem\]$/i.test(legenda)
                ? `Legenda escrita pelo cliente: "${legenda.slice(0, 300)}". Analise a imagem:`
                : "Analise esta imagem enviada pelo cliente:",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    let aiRes: Response | null = null;
    let ultimoErro = "";
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        console.log("[descrever-imagem] gateway", { tentativa, status: aiRes.status, ms: Date.now() - t0 });
        if (aiRes.ok) break;
        if (aiRes.status !== 429 && aiRes.status < 500) break;
        ultimoErro = `status ${aiRes.status}`;
      } catch (e: any) {
        ultimoErro = e?.message || "falha de rede";
        aiRes = null;
      }
      if (tentativa === 1) await sleep(1500);
    }

    if (!aiRes) return json({ error: "Falha ao analisar a imagem.", details: ultimoErro }, 502);
    if (!aiRes.ok) {
      const detalhe = await aiRes.text().catch(() => "");
      console.error("[descrever-imagem] gateway erro", aiRes.status, detalhe.slice(0, 500));
      const msgErro = aiRes.status === 429
        ? "Muitas requisições de IA. Tente novamente em alguns segundos."
        : aiRes.status === 402
          ? "Créditos de IA esgotados."
          : "Falha ao analisar a imagem.";
      return json({ error: msgErro, status: aiRes.status, details: detalhe }, aiRes.status);
    }

    const result = await aiRes.json().catch(() => ({}));
    const bruto = String((result as any)?.choices?.[0]?.message?.content || "").trim();
    const parsed = extrairJson(bruto) || {};
    const descricao = String(parsed.descricao || (parsed.classificacao ? "" : bruto)).trim().slice(0, 600);
    let classificacao = String(parsed.classificacao || "").toLowerCase().trim();
    if (!CLASSES.includes(classificacao as any)) classificacao = descricao ? "documento" : "ilegivel";

    if (!descricao || classificacao === "ilegivel") {
      console.log("[descrever-imagem] imagem sem leitura útil", { mensagem_id: mensagemId, classificacao });
      return json({ error: "não foi possível entender a imagem", classificacao: "ilegivel" }, 422);
    }

    console.log("[descrever-imagem] concluído", {
      mensagem_id: mensagemId, classificacao, caracteres: descricao.length, ms: Date.now() - t0,
    });
    return json({ ok: true, descricao, classificacao });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro inesperado";
    console.error("[descrever-imagem] exceção", message);
    return json({ error: message }, 500);
  }
});
