// Conversa automática intra-grupo de aquecimento (família simulada).
// Cron a cada 15min. Sorteia 1 cena por grupo ativo, escolhe membros
// elegíveis (carência + limites + idade do chip), envia sequência
// texto/áudio/imagem com delays randomizados.
//
// ANTI-BAN (v2):
// - Janela 09h-19h BRT, todos os dias (incluindo domingo).
// - Áudios SÃO arquivos reais gravados (bucket campaign-audio/aquecimento),
//   nada de TTS — TTS gera hash idêntico entre grupos e queima os chips.
// - Bloqueia chips com menos de 5 dias de criação (só observam).
// - Anti-duplicação de frase: não usa a mesma mensagem em outro grupo no mesmo dia.
// - Anti-duplicação de cena: evita rodar o mesmo contexto em outro grupo nas últimas 6h.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { getCalendarioHoje } from "../_shared/calendario-aquecimento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IDADE_MINIMA_CHIP_DIAS = 5;

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

async function listarArquivosBucket(supa: any, bucket: string, pasta: string): Promise<string[]> {
  try {
    const { data, error } = await supa.storage.from(bucket).list(pasta, { limit: 200 });
    if (error || !data) return [];
    return data.filter((f: any) => f.name && !f.name.startsWith(".")).map((f: any) => f.name);
  } catch { return []; }
}

function urlPublica(supa: any, bucket: string, path: string): string {
  const { data } = supa.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
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
    body = { number: groupJid, type: "ptt", file: conteudo };
  } else {
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

async function processarGrupo(
  supa: any,
  grupo: any,
  config: any,
  ctx: { textosUsadosHoje: Set<string>; contextosUsados6h: Set<string>; audiosBucket: string[]; imagensBucket: string[] },
  forcar = false,
): Promise<{ enviados: number; erros: number; pulado?: string }> {
  const inicioBrt = new Date(brtNow().toDateString());
  const hojeIso = inicioBrt.toISOString();

  const { count: enviadasHoje } = await supa
    .from("whatsapp_aquecimento_grupo_conversas_log")
    .select("id", { count: "exact", head: true })
    .eq("grupo_id", grupo.id)
    .eq("sucesso", true)
    .gte("enviado_em", hojeIso);

  const target = rand(config.msgs_min_dia, config.msgs_max_dia);
  if ((enviadasHoje || 0) >= target) return { enviados: 0, erros: 0, pulado: `meta diária ${target} atingida` };

  const horaBrt = brtNow().getHours();
  const ciclosRestantes = Math.max(1, ((19 - horaBrt) * 60) / 15);
  const restante = target - (enviadasHoje || 0);
  const probDisparar = Math.min(1, (restante * 1.4) / ciclosRestantes / 3);
  if (!forcar && Math.random() > probDisparar) return { enviados: 0, erros: 0, pulado: "prob não disparou" };

  // Membros elegíveis: status=ok, instância ativa, fora da carência, chip com idade >= 5 dias
  const carenciaIso = new Date(Date.now() - config.carencia_horas * 3600 * 1000).toISOString();
  const idadeIso = new Date(Date.now() - IDADE_MINIMA_CHIP_DIAS * 24 * 3600 * 1000).toISOString();
  const { data: membros } = await supa
    .from("whatsapp_aquecimento_grupo_membros")
    .select("instancia_id, adicionado_em, user_whatsapp_instances!inner(id, server_url, instance_token, ativo, nome, criado_em)")
    .eq("grupo_id", grupo.id)
    .eq("status", "ok")
    .lte("adicionado_em", carenciaIso);

  const elegiveis = (membros || []).filter((m: any) => {
    const inst = m.user_whatsapp_instances;
    if (!inst?.ativo) return false;
    if (!inst.criado_em || inst.criado_em > idadeIso) return false; // chip muito novo
    return true;
  });
  if (elegiveis.length < 2) return { enviados: 0, erros: 0, pulado: `só ${elegiveis.length} membros elegíveis (idade>=5d)` };

  // Limite por instância no dia (todas as fontes de envio em grupo)
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

  // Sorteia uma cena que NÃO foi usada em outro grupo nas últimas 6h
  const { data: contextos } = await supa
    .from("whatsapp_aquecimento_grupo_dialogos_pool")
    .select("contexto")
    .eq("ativo", true)
    .eq("ordem_na_cena", 0);
  let contextosUnicos = Array.from(new Set((contextos || []).map((c: any) => c.contexto)))
    .filter((c: any) => c !== "generico_resposta" && c !== "reacao_curta");
  const contextosFresh = contextosUnicos.filter((c: any) => !ctx.contextosUsados6h.has(c));
  if (contextosFresh.length > 0) contextosUnicos = contextosFresh;
  if (contextosUnicos.length === 0) return { enviados: 0, erros: 0, pulado: "pool vazio" };
  const contexto = pick(contextosUnicos);

  const { data: msgsDaCena } = await supa
    .from("whatsapp_aquecimento_grupo_dialogos_pool")
    .select("*")
    .eq("contexto", contexto)
    .eq("ativo", true)
    .order("ordem_na_cena", { ascending: true });

  if (!msgsDaCena?.length) return { enviados: 0, erros: 0, pulado: "cena sem msgs" };

  // Monta sequência evitando reusar texto já enviado hoje em outro grupo
  function escolherMsgFresca(opts: any[]): any | null {
    if (!opts.length) return null;
    const fresh = opts.filter((m: any) => m.tipo !== "texto" || !ctx.textosUsadosHoje.has(m.conteudo));
    return fresh.length ? pick(fresh) : pick(opts);
  }

  const ordemMax = Math.max(...msgsDaCena.map((m: any) => m.ordem_na_cena));
  const sequencia: any[] = [];
  const msgs0 = msgsDaCena.filter((m: any) => m.ordem_na_cena === 0);
  const m0 = escolherMsgFresca(msgs0);
  if (m0) sequencia.push(m0);
  const numRespostas = rand(1, Math.min(3, podemFalar.length - 1));
  for (let ord = 1; ord <= ordemMax && sequencia.length < numRespostas + 1; ord++) {
    const opts = msgsDaCena.filter((m: any) => m.ordem_na_cena === ord);
    const m = escolherMsgFresca(opts);
    if (m) sequencia.push(m);
  }

  // Falantes (sem repetir consecutivos)
  let candidatos = shuffle(podemFalar);
  if (ultimo?.instancia_id && candidatos[0]?.instancia_id === ultimo.instancia_id && candidatos.length > 1) {
    [candidatos[0], candidatos[1]] = [candidatos[1], candidatos[0]];
  }
  const falantes: any[] = [];
  for (let i = 0; i < sequencia.length; i++) falantes.push(candidatos[i % candidatos.length]);

  // Mix
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
    if (tipoFinal === "audio" && (cnt.audio >= config.max_audios_por_instancia_dia || ctx.audiosBucket.length === 0)) tipoFinal = "texto";
    if (tipoFinal === "imagem" && (cnt.imagem >= config.max_imagens_por_instancia_dia || ctx.imagensBucket.length === 0)) tipoFinal = "texto";

    let conteudo = msg.conteudo;
    if (tipoFinal === "audio") {
      // Áudio REAL gravado, sem TTS — bucket campaign-audio/aquecimento
      conteudo = urlPublica(supa, "campaign-audio", `aquecimento/${pick(ctx.audiosBucket)}`);
    } else if (tipoFinal === "imagem") {
      conteudo = pick(ctx.imagensBucket);
    }

    const inst = falante.user_whatsapp_instances;
    const r = await uazapiSend(inst.server_url, inst.instance_token, grupo.group_jid, tipoFinal, conteudo);

    await supa.from("whatsapp_aquecimento_grupo_conversas_log").insert({
      grupo_id: grupo.id,
      instancia_id: falante.instancia_id,
      contexto,
      tipo: tipoFinal,
      conteudo_preview: tipoFinal === "imagem" ? "[imagem]" : tipoFinal === "audio" ? "[audio]" : conteudo.slice(0, 200),
      sucesso: r.ok,
      erro: r.error || null,
    });

    if (r.ok) {
      enviados++;
      cnt.total++;
      if (tipoFinal === "audio") cnt.audio++;
      if (tipoFinal === "imagem") cnt.imagem++;
      contagem.set(falante.instancia_id, cnt);
      if (tipoFinal === "texto") ctx.textosUsadosHoje.add(msg.conteudo);
      ctx.contextosUsados6h.add(contexto);
      await supa.from("whatsapp_aquecimento_grupo_dialogos_pool")
        .update({ vezes_utilizada: (msg.vezes_utilizada || 0) + 1 })
        .eq("id", msg.id);
    } else {
      erros++;
    }

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

    if (!forcar) {
      // Janela mais conservadora: 09h-19h BRT (todos os dias)
      if (hora < 9 || hora >= 19) {
        return new Response(JSON.stringify({ pulado: `fora da janela (${hora}h BRT)` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let q = supa.from("whatsapp_aquecimento_grupos")
      .select("id, group_jid, nome, ativo, whatsapp_aquecimento_grupo_config!inner(*)")
      .eq("ativo", true);
    if (grupoIdForce) q = q.eq("id", grupoIdForce);
    const { data: grupos, error } = await q;
    if (error) throw error;

    const ativos = (grupos || []).filter((g: any) => g.whatsapp_aquecimento_grupo_config?.ativo);

    // Contexto compartilhado anti-duplicação entre grupos
    const inicioBrtIso = new Date(brtNow().toDateString()).toISOString();
    const { data: textosHoje } = await supa
      .from("whatsapp_aquecimento_grupo_conversas_log")
      .select("conteudo_preview, contexto, enviado_em, tipo")
      .gte("enviado_em", inicioBrtIso)
      .eq("sucesso", true);

    const seis_h_atras = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const ctx = {
      textosUsadosHoje: new Set<string>((textosHoje || []).filter((r: any) => r.tipo === "texto").map((r: any) => r.conteudo_preview)),
      contextosUsados6h: new Set<string>((textosHoje || []).filter((r: any) => r.enviado_em >= seis_h_atras).map((r: any) => r.contexto)),
      audiosBucket: await listarArquivosBucket(supa, "campaign-audio", "aquecimento"),
      imagensBucket: [] as string[],
    };

    // Imagens: mantém o pool atual (status_imagens) já alimentado pelo usuário
    const { data: imgs } = await supa
      .from("whatsapp_aquecimento_status_imagens")
      .select("public_url")
      .eq("ativo", true);
    ctx.imagensBucket = (imgs || []).map((i: any) => i.public_url);

    const resultados: any[] = [];
    for (const g of ativos) {
      const r = await processarGrupo(supa, g, g.whatsapp_aquecimento_grupo_config, ctx, forcar);
      resultados.push({ grupo: g.nome, ...r });
    }

    return new Response(JSON.stringify({
      ok: true,
      processados: ativos.length,
      audios_disponiveis: ctx.audiosBucket.length,
      resultados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[aquecimento-grupo-conversa] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e), fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
