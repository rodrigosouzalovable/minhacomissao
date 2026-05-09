// Conversa automática intra-grupo de aquecimento (família simulada).
// Cron a cada 15min. Sorteia 1 cena por grupo ativo, escolhe membros
// elegíveis (carência + limites), envia sequência texto/áudio/imagem
// com delays randomizados.
//
// Janela: 07h-21h BRT, nunca aos domingos.
// Mix: 70% texto, 20% áudio (Google Translate TTS), 10% imagem (pool).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brtNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ttsUrl(text: string): string {
  const cleaned = text.slice(0, 190).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(cleaned)}`;
}

async function uazapiSend(
  serverUrl: string,
  token: string,
  groupJid: string,
  tipo: string,
  conteudo: string,
): Promise<{ ok: boolean; error?: string }> {
  const base = serverUrl.replace(/\/+$/, "");
  let endpoint: string, body: any;
  if (tipo === "texto") {
    endpoint = `${base}/send/text`;
    body = { number: groupJid, text: conteudo };
  } else if (tipo === "audio") {
    endpoint = `${base}/send/media`;
    body = { number: groupJid, type: "ptt", file: ttsUrl(conteudo) };
  } else {
    // imagem
    endpoint = `${base}/send/media`;
    body = { number: groupJid, type: "image", file: conteudo };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const text = await res.text();
    let data: any; try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!res.ok) return { ok: false, error: data?.message || data?.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch failed" };
  }
}

async function processarGrupo(supa: any, grupo: any, config: any, forcar = false): Promise<{ enviados: number; erros: number; pulado?: string }> {
  const inicioBrt = new Date(brtNow().toDateString());
  const inicioIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString(); // últimas 24h
  const hojeIso = inicioBrt.toISOString();

  // Conta msgs hoje no grupo
  const { count: enviadasHoje } = await supa
    .from("whatsapp_aquecimento_grupo_conversas_log")
    .select("id", { count: "exact", head: true })
    .eq("grupo_id", grupo.id)
    .eq("sucesso", true)
    .gte("enviado_em", hojeIso);

  const target = rand(config.msgs_min_dia, config.msgs_max_dia);
  if ((enviadasHoje || 0) >= target) return { enviados: 0, erros: 0, pulado: `meta diária ${target} atingida` };

  // Probabilidade de disparar: ciclos restantes no dia (~56 ciclos de 15min de 7h-21h)
  const horaBrt = brtNow().getHours();
  const ciclosRestantes = Math.max(1, ((21 - horaBrt) * 60) / 15);
  const restante = target - (enviadasHoje || 0);
  // Multiplicador 1.4 para dar folga (cenas tem 2-4 msgs)
  const probDisparar = Math.min(1, (restante * 1.4) / ciclosRestantes / 3);
  if (!forcar && Math.random() > probDisparar) return { enviados: 0, erros: 0, pulado: "prob não disparou" };

  // Membros elegíveis: status=ok, instância ativa, fora da carência
  const carenciaIso = new Date(Date.now() - config.carencia_horas * 3600 * 1000).toISOString();
  const { data: membros } = await supa
    .from("whatsapp_aquecimento_grupo_membros")
    .select("instancia_id, adicionado_em, user_whatsapp_instances!inner(id, server_url, instance_token, ativo, nome)")
    .eq("grupo_id", grupo.id)
    .eq("status", "ok")
    .lte("adicionado_em", carenciaIso);

  const elegiveis = (membros || []).filter((m: any) => m.user_whatsapp_instances?.ativo);
  if (elegiveis.length < 2) return { enviados: 0, erros: 0, pulado: `só ${elegiveis.length} membros elegíveis` };

  // Filtra por limite diário por instância
  const { data: enviosHoje } = await supa
    .from("whatsapp_aquecimento_grupo_conversas_log")
    .select("instancia_id, tipo")
    .eq("grupo_id", grupo.id)
    .eq("sucesso", true)
    .gte("enviado_em", hojeIso);

  const contagem = new Map<string, { total: number; audio: number; imagem: number }>();
  for (const e of enviosHoje || []) {
    const c = contagem.get(e.instancia_id) || { total: 0, audio: 0, imagem: 0 };
    c.total++;
    if (e.tipo === "audio") c.audio++;
    if (e.tipo === "imagem") c.imagem++;
    contagem.set(e.instancia_id, c);
  }

  // Quem falou por último (não pode ser o primeiro da rajada)
  const { data: ultimo } = await supa
    .from("whatsapp_aquecimento_grupo_conversas_log")
    .select("instancia_id")
    .eq("grupo_id", grupo.id)
    .order("enviado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const podemFalar = elegiveis.filter((m: any) => {
    const c = contagem.get(m.instancia_id) || { total: 0, audio: 0, imagem: 0 };
    return c.total < config.max_msgs_por_instancia_dia;
  });
  if (podemFalar.length < 2) return { enviados: 0, erros: 0, pulado: "todos no limite" };

  // Sorteia uma cena
  const { data: contextos } = await supa
    .from("whatsapp_aquecimento_grupo_dialogos_pool")
    .select("contexto")
    .eq("ativo", true)
    .eq("ordem_na_cena", 0);
  const contextosUnicos = Array.from(new Set((contextos || []).map((c: any) => c.contexto))).filter((c: any) => c !== "generico_resposta" && c !== "reacao_curta");
  if (contextosUnicos.length === 0) return { enviados: 0, erros: 0, pulado: "pool vazio" };
  const contexto = pick(contextosUnicos);

  // Pega todas as msgs da cena
  const { data: msgsDaCena } = await supa
    .from("whatsapp_aquecimento_grupo_dialogos_pool")
    .select("*")
    .eq("contexto", contexto)
    .eq("ativo", true)
    .order("ordem_na_cena", { ascending: true });

  if (!msgsDaCena?.length) return { enviados: 0, erros: 0, pulado: "cena sem msgs" };

  // Monta sequência: ordem 0 (1 msg) + 1-3 respostas variadas
  const ordemMax = Math.max(...msgsDaCena.map((m: any) => m.ordem_na_cena));
  const sequencia: any[] = [];
  const msgs0 = msgsDaCena.filter((m: any) => m.ordem_na_cena === 0);
  if (msgs0.length) sequencia.push(pick(msgs0));
  const numRespostas = rand(1, Math.min(3, podemFalar.length - 1));
  for (let ord = 1; ord <= ordemMax && sequencia.length < numRespostas + 1; ord++) {
    const opts = msgsDaCena.filter((m: any) => m.ordem_na_cena === ord);
    if (opts.length) sequencia.push(pick(opts));
  }

  // Sorteia falantes (round-robin sem repetir consecutivos)
  let candidatos = shuffle(podemFalar);
  if (ultimo?.instancia_id && candidatos[0]?.instancia_id === ultimo.instancia_id && candidatos.length > 1) {
    [candidatos[0], candidatos[1]] = [candidatos[1], candidatos[0]];
  }
  const falantes: any[] = [];
  let idx = 0;
  for (const _ of sequencia) {
    falantes.push(candidatos[idx % candidatos.length]);
    idx++;
  }

  // Pool de imagens (se tiver msgs tipo imagem)
  const temImagem = sequencia.some((m: any) => m.tipo === "imagem");
  let imagensUrls: string[] = [];
  if (temImagem) {
    const { data: imgs } = await supa
      .from("whatsapp_aquecimento_status_imagens")
      .select("public_url")
      .eq("ativo", true);
    imagensUrls = (imgs || []).map((i: any) => i.public_url);
  }

  // Aplica mix de mídia: substitui tipo conforme config (a msg do pool é só sugestão)
  const totalMix = config.mix_texto + config.mix_audio + config.mix_imagem;
  function sortearTipo(): string {
    const r = Math.random() * totalMix;
    if (r < config.mix_texto) return "texto";
    if (r < config.mix_texto + config.mix_audio) return "audio";
    return "imagem";
  }

  let enviados = 0, erros = 0;

  for (let i = 0; i < sequencia.length; i++) {
    const msg = sequencia[i];
    const falante = falantes[i];
    const cnt = contagem.get(falante.instancia_id) || { total: 0, audio: 0, imagem: 0 };

    let tipoFinal = sortearTipo();
    // Respeita limites individuais
    if (tipoFinal === "audio" && cnt.audio >= config.max_audios_por_instancia_dia) tipoFinal = "texto";
    if (tipoFinal === "imagem" && (cnt.imagem >= config.max_imagens_por_instancia_dia || imagensUrls.length === 0)) tipoFinal = "texto";

    let conteudo = msg.conteudo;
    if (tipoFinal === "imagem") conteudo = pick(imagensUrls);

    const inst = falante.user_whatsapp_instances;
    const r = await uazapiSend(inst.server_url, inst.instance_token, grupo.group_jid, tipoFinal, conteudo);

    await supa.from("whatsapp_aquecimento_grupo_conversas_log").insert({
      grupo_id: grupo.id,
      instancia_id: falante.instancia_id,
      contexto,
      tipo: tipoFinal,
      conteudo_preview: tipoFinal === "imagem" ? "[imagem]" : conteudo.slice(0, 200),
      sucesso: r.ok,
      erro: r.error || null,
    });

    if (r.ok) {
      enviados++;
      cnt.total++;
      if (tipoFinal === "audio") cnt.audio++;
      if (tipoFinal === "imagem") cnt.imagem++;
      contagem.set(falante.instancia_id, cnt);
      // Marca uso no pool
      await supa.from("whatsapp_aquecimento_grupo_dialogos_pool")
        .update({ vezes_utilizada: (msg.vezes_utilizada || 0) + 1 })
        .eq("id", msg.id);
    } else {
      erros++;
    }

    // Delay entre mensagens da rajada (15-80s), exceto após a última
    if (i < sequencia.length - 1) {
      await new Promise((r) => setTimeout(r, rand(15, 80) * 1000));
    }
  }

  return { enviados, erros };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true;
    const grupoIdForce = body?.grupo_id || null;

    const agora = brtNow();
    const hora = agora.getHours();
    const dia = agora.getDay();

    if (!forcar) {
      // Conversa em grupo roda todos os dias (incluindo domingo), apenas dentro da janela 07-21h BRT.
      if (hora < 7 || hora >= 21) return new Response(JSON.stringify({ pulado: `fora da janela (${hora}h BRT)` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    void dia;

    let q = supa.from("whatsapp_aquecimento_grupos")
      .select("id, group_jid, nome, ativo, whatsapp_aquecimento_grupo_config!inner(*)")
      .eq("ativo", true);
    if (grupoIdForce) q = q.eq("id", grupoIdForce);
    const { data: grupos, error } = await q;
    if (error) throw error;

    const ativos = (grupos || []).filter((g: any) => g.whatsapp_aquecimento_grupo_config?.ativo);
    const resultados: any[] = [];
    for (const g of ativos) {
      const r = await processarGrupo(supa, g, g.whatsapp_aquecimento_grupo_config, forcar);
      resultados.push({ grupo: g.nome, ...r });
    }

    return new Response(JSON.stringify({ ok: true, processados: ativos.length, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[aquecimento-grupo-conversa] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e), fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
