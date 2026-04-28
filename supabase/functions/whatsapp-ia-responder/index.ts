import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Probabilidade de responder por fase (skip silencioso simulando humano ocupado)
const PROB_RESPOSTA_POR_FASE: Record<number, number> = { 1: 0.6, 2: 0.8 };
const FALLBACK_FINAL = "Ah legal!";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ========== AUDITORIA: nunca quebra o fluxo ==========
async function auditar(row: {
  instancia_origem_id?: string | null;
  instancia_destino_id?: string | null;
  numero_origem?: string | null;
  numero_destino?: string | null;
  etapa: 'webhook_in' | 'ollama_call' | 'uazapi_send' | 'cascade_skip';
  status: 'ok' | 'falhou' | 'timeout' | 'ignorado';
  mensagem_original?: string | null;
  resposta_gerada?: string | null;
  motivo?: string | null;
  http_status?: number | null;
  tempo_resposta_ms?: number | null;
}) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from('whatsapp_conversas_auditoria').insert({
      ...row,
      mensagem_original: row.mensagem_original?.substring(0, 500) ?? null,
      resposta_gerada: row.resposta_gerada?.substring(0, 500) ?? null,
      motivo: row.motivo?.substring(0, 300) ?? null,
    });
  } catch (_e) { /* silencioso */ }
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

// Humanized delay distribution simulating real human response patterns
function humanizedDelay(): number {
  const roll = Math.random();
  if (roll < 0.30) {
    // 30%: fast reply (5-15s) — had phone in hand
    return randomDelay(5000, 15000);
  } else if (roll < 0.70) {
    // 40%: normal reply (30-90s) — read and replied
    return randomDelay(30000, 90000);
  } else if (roll < 0.90) {
    // 20%: slow reply (2-5 min) — was busy
    return randomDelay(120000, 300000);
  } else {
    // 10%: very slow (5-10 min) — went to do something else
    return randomDelay(300000, 600000);
  }
}

// Send "typing..." indicator before message for natural feel
async function enviarTypingIndicator(serverUrl: string, instanceToken: string, numero: string, textoLength: number): Promise<void> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  // Duration proportional to message length: 1-4 seconds
  const typingDuration = Math.min(1000 + textoLength * 30, 4000);
  
  try {
    // Start composing
    await fetch(`${cleanUrl}/send/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({ number: numero, state: "composing" }),
    }).catch(() => {});
    
    // Wait for typing duration
    await new Promise(r => setTimeout(r, typingDuration));
    
    // Stop composing
    await fetch(`${cleanUrl}/send/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({ number: numero, state: "paused" }),
    }).catch(() => {});
  } catch (e) {
    console.warn("[IA] Typing indicator error (non-critical):", e);
  }
}

function buildSystemPrompt(totalTrocas: number, maxTrocas: number): string {
  const trocasRestantes = maxTrocas - totalTrocas;
  const estaFinalizando = trocasRestantes <= 3;

  let instrucaoEncerramento = "";
  if (estaFinalizando) {
    if (trocasRestantes <= 1) {
      instrucaoEncerramento = `\nEsta é sua ÚLTIMA mensagem. Encerre naturalmente, como se tivesse que ir. Ex: "bom, vou nessa, depois a gente se fala!", "tenho que resolver umas coisas, tmj!". NÃO diga "tchau" formalmente.`;
    } else {
      instrucaoEncerramento = `\nA conversa está acabando. Dê sinais sutis de que vai sair. Ex: "cara preciso ir daqui a pouco", "tô ficando sem bateria".`;
    }
  }

  return `Você é um brasileiro comum conversando no WhatsApp com um amigo/conhecido.
Responda de forma natural, informal e curta como uma pessoa real.
Use gírias brasileiras (tipo "kkk", "kkkk", "massa", "show", "tmj", "mano", "cara", "bora", "top", "pô").
Use emojis de vez em quando (👍, 😂, 🙏, 😄, 🔥, 😎, 🤣) mas NÃO em toda mensagem.
Varie o tamanho BASTANTE: às vezes só "kkk" ou "sério??", às vezes 1-2 frases, raramente 3 frases.
NÃO use formatação markdown. NÃO se apresente. NÃO seja formal. NÃO use pontuação perfeita.
Cometa "erros" naturais: abreviações (vc, tb, pq, qd, blz, vlw, ngm, td), minúsculas, sem ponto final.
Faça perguntas para manter a conversa ("e vc?", "sério? conta mais", "e o trabalho?").
Mude de assunto naturalmente às vezes.
NUNCA repita a mesma estrutura duas vezes seguidas.${instrucaoEncerramento}`;
}

// ========== OLLAMA LOCAL (Gemma) — substitui Lovable AI Gateway ==========
const OLLAMA_MODEL = Deno.env.get("OLLAMA_MODEL") || "gemma4:e4b";
const OLLAMA_API_KEY = Deno.env.get("OLLAMA_API_KEY") || "";

async function callOllama(messages: { role: string; content: string }[], opts: { timeoutMs?: number; numPredict?: number; temperature?: number; auditCtx?: { instancia_origem_id?: string; instancia_destino_id?: string; numero_destino?: string } } = {}): Promise<string | null> {
  const ollamaUrl = Deno.env.get("OLLAMA_NGROK_URL");
  const auditCtx = opts.auditCtx || {};
  if (!ollamaUrl) {
    console.warn("[IA] OLLAMA_NGROK_URL não configurado");
    auditar({ etapa: 'ollama_call', status: 'falhou', motivo: 'OLLAMA_NGROK_URL ausente', ...auditCtx });
    return null;
  }
  const cleanUrl = ollamaUrl.replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? 30000; // subido de 20s → 30s

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    };
    if (OLLAMA_API_KEY) headers["Authorization"] = `Bearer ${OLLAMA_API_KEY}`;

    const response = await fetch(`${cleanUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: opts.temperature ?? 0.8,
          num_predict: opts.numPredict ?? 80,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const ms = Date.now() - t0;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[IA-Ollama] HTTP_ERR ${response.status} ms=${ms}: ${errText.substring(0, 200)}`);
      auditar({ etapa: 'ollama_call', status: 'falhou', http_status: response.status, tempo_resposta_ms: ms, motivo: errText.substring(0, 200), ...auditCtx });
      return null;
    }

    const data = await response.json();
    const content = (data.message?.content || data.response || "").trim();
    console.log(`[IA-Ollama] OK ms=${ms} model=${OLLAMA_MODEL} len=${content.length}`);
    auditar({ etapa: 'ollama_call', status: 'ok', http_status: response.status, tempo_resposta_ms: ms, resposta_gerada: content, ...auditCtx });
    return content || null;
  } catch (err) {
    clearTimeout(timeout);
    const ms = Date.now() - t0;
    const isTimeout = (err as Error)?.name === 'AbortError';
    console.error(`[IA-Ollama] ${isTimeout ? 'TIMEOUT' : 'ERRO'} ms=${ms}:`, err);
    auditar({ etapa: 'ollama_call', status: isTimeout ? 'timeout' : 'falhou', tempo_resposta_ms: ms, motivo: String(err).substring(0, 200), ...auditCtx });
    return null;
  }
}

async function chamarIA(mensagem: string, historico: string, totalTrocas: number, maxTrocas: number, auditCtx?: { instancia_origem_id?: string; instancia_destino_id?: string; numero_destino?: string }): Promise<string> {
  const systemPrompt = buildSystemPrompt(totalTrocas, maxTrocas);
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (historico) {
    messages.push({ role: "user", content: `Histórico recente da conversa:\n${historico}` });
    messages.push({ role: "assistant", content: "Ok, entendi o contexto. Vou continuar naturalmente." });
  }

  messages.push({ role: "user", content: mensagem });

  const raw = await callOllama(messages, { timeoutMs: 30000, numPredict: 80, temperature: 0.85, auditCtx });
  if (!raw) {
    auditar({ etapa: 'cascade_skip', status: 'ignorado', motivo: 'ollama_null_fallback', mensagem_original: mensagem, ...auditCtx });
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }

  let resposta = raw.replace(/^["']|["']$/g, "").trim();
  if (!resposta || resposta.length < 2) {
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }
  if (resposta.length > 200) {
    resposta = resposta.substring(0, 200).replace(/\s\S*$/, "");
  }
  console.log(`[IA-Ollama] Resposta (troca ${totalTrocas + 1}/${maxTrocas}): "${resposta}"`);
  return resposta;
}

async function gerarMensagemInicial(): Promise<string> {
  const tema = TEMAS_CONVERSA[Math.floor(Math.random() * TEMAS_CONVERSA.length)];

  const messages = [
    {
      role: "system",
      content: `Você é um brasileiro comum no WhatsApp. Gere UMA mensagem curta e casual para iniciar uma conversa com um amigo sobre: ${tema}. 
Seja informal, use gírias, abreviações. Pode usar emoji mas com moderação. 
Exemplos de tom: "e aí mano, viu o jogo ontem?", "cara tô morrendo de calor hj", "vc viu aquele filme novo?", "mano q fome, oq vc almoçou?".
Responda APENAS com a mensagem, sem explicações.`,
    },
    { role: "user", content: "Gere a mensagem inicial." },
  ];

  const raw = await callOllama(messages, { timeoutMs: 15000, numPredict: 60, temperature: 0.9 });
  if (!raw) return "e aí, tudo bem? 😊";

  let msg = raw.replace(/^["']|["']$/g, "").trim();
  if (!msg || msg.length < 2) return "e aí, tudo bem? 😊";
  if (msg.length > 150) msg = msg.substring(0, 150);
  console.log(`[IA-Ollama] Mensagem inicial gerada (tema: ${tema}): "${msg}"`);
  return msg;
}

async function salvarContatoUAZAPI(serverUrl: string, instanceToken: string, numero: string, nome: string): Promise<boolean> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const cleanNumber = numero.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
  console.log(`[IA] 📋 Tentando salvar contato na agenda: numero=${cleanNumber}, nome="${nome}", server=${cleanUrl}`);
  
  const payloads = [
    { number: cleanNumber, name: nome },
    { number: `${cleanNumber}@s.whatsapp.net`, name: nome },
    { phone: cleanNumber, name: nome, displayName: nome },
  ];
  const endpoints = [
    `${cleanUrl}/contact/add`,
    `${cleanUrl}/contacts/add`,
    `${cleanUrl}/contact/upsert`,
    `${cleanUrl}/contacts/upsert`,
  ];

  for (const url of endpoints) {
    for (const payload of payloads) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: instanceToken },
          body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log(`[IA] 📱 ${url} payload=${JSON.stringify(payload)} → status=${res.status} body=${text.substring(0, 200)}`);
        if (res.ok) {
          console.log(`[IA] ✅ Contato salvo na agenda: ${cleanNumber} como "${nome}" via ${url}`);
          return true;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[IA] Endpoint contato ${url} falhou: ${msg}`);
      }
    }
  }
  console.warn(`[IA] ⚠️ Não foi possível salvar contato ${cleanNumber} na agenda (todos endpoints falharam)`);
  return false;
}

async function enviarMensagemUAZAPI(serverUrl: string, instanceToken: string, numero: string, texto: string, auditCtx?: { instancia_origem_id?: string; instancia_destino_id?: string }): Promise<boolean> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const endpoints = [`${cleanUrl}/send/text`, `${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`];
  let lastStatus: number | null = null;
  let lastBody: string = '';

  for (const url of endpoints) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: instanceToken },
        body: JSON.stringify({ number: numero, text: texto }),
      });
      const ms = Date.now() - t0;
      lastStatus = res.status;
      const body = await res.text();
      lastBody = body.substring(0, 200);
      if (res.ok) {
        console.log(`[IA] ✅ Enviada via ${url} ms=${ms} status=${res.status} → ${numero}: "${texto}"`);
        auditar({ etapa: 'uazapi_send', status: 'ok', http_status: res.status, tempo_resposta_ms: ms, numero_destino: numero, resposta_gerada: texto, motivo: url, ...(auditCtx || {}) });
        return true;
      }
      console.warn(`[IA] Endpoint ${url} status=${res.status} ms=${ms} body=${lastBody}`);
    } catch (e) {
      const ms = Date.now() - t0;
      lastBody = String(e).substring(0, 200);
      console.warn(`[IA] Endpoint ${url} ms=${ms} falhou:`, e);
      auditar({ etapa: 'uazapi_send', status: 'falhou', tempo_resposta_ms: ms, numero_destino: numero, motivo: `${url}: ${lastBody}`, ...(auditCtx || {}) });
    }
  }
  console.error(`[IA] ❌ Falha ao enviar para ${numero} (último status=${lastStatus})`);
  auditar({ etapa: 'uazapi_send', status: 'falhou', http_status: lastStatus, numero_destino: numero, resposta_gerada: texto, motivo: `all endpoints failed: ${lastBody}`, ...(auditCtx || {}) });
  return false;
}

// ========== MEDIA HELPERS (Audio + Image) ==========

async function listarMidiaAquecimento(sb: any, pasta: string): Promise<string[]> {
  try {
    const { data: files, error } = await sb.storage
      .from("campaign-audio")
      .list(pasta, { limit: 100 });
    if (error || !files) {
      console.warn(`[IA] Erro listando mídia em ${pasta}:`, error);
      return [];
    }
    return files
      .filter((f: any) => f.name && !f.name.startsWith("."))
      .map((f: any) => f.name);
  } catch (e) {
    console.warn(`[IA] Erro listando mídia ${pasta}:`, e);
    return [];
  }
}

function getPublicUrl(sb: any, bucket: string, path: string): string {
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function enviarAudioUAZAPI(serverUrl: string, instanceToken: string, numero: string, audioUrl: string): Promise<boolean> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(`${cleanUrl}/send/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({ number: numero, type: "ptt", file: audioUrl }),
    });
    const text = await res.text();
    console.log(`[IA] 🎙️ Áudio enviado para ${numero}: status=${res.status} body=${text.substring(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error(`[IA] ❌ Erro envio áudio:`, e);
    return false;
  }
}

async function enviarImagemUAZAPI(serverUrl: string, instanceToken: string, numero: string, imageUrl: string, caption?: string): Promise<boolean> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  try {
    const body: any = { number: numero, type: "image", file: imageUrl };
    if (caption) body.caption = caption;
    const res = await fetch(`${cleanUrl}/send/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`[IA] 🖼️ Imagem enviada para ${numero}: status=${res.status} body=${text.substring(0, 200)}`);
    return res.ok;
  } catch (e) {
    console.error(`[IA] ❌ Erro envio imagem:`, e);
    return false;
  }
}

async function logToInbox(sb: any, instanciaId: string, telefoneRemoto: string, texto: string, direcao: "saida" | "entrada" = "saida", tipoConteudo: string = "texto", mediaUrl?: string) {
  try {
    const cleanPhone = telefoneRemoto.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
    const phoneSuffix = cleanPhone.replace(/^55/, "").slice(-8);

    const { data: contato } = await sb
      .from("whatsapp_contatos")
      .select("id, telefone")
      .eq("instancia_id", instanciaId)
      .or(`telefone.eq.${cleanPhone},telefone.ilike.%${phoneSuffix}`)
      .maybeSingle();

    let phoneToStore = contato?.telefone || cleanPhone;

    if (!contato) {
      const { data: newContato } = await sb.from("whatsapp_contatos").insert({
        instancia_id: instanciaId,
        telefone: cleanPhone,
        nome: cleanPhone,
        ultima_mensagem: texto.slice(0, 200),
        ultima_mensagem_em: new Date().toISOString(),
      }).select("id, telefone").single();

      if (newContato) {
        phoneToStore = newContato.telefone;
        console.log(`[IA] 📇 Contato criado: ${cleanPhone} para instância ${instanciaId}`);
      }
    } else {
      await sb.from("whatsapp_contatos").update({
        ultima_mensagem: texto.slice(0, 200),
        ultima_mensagem_em: new Date().toISOString(),
      }).eq("id", contato.id);
    }

    const insertData: any = {
      instancia_id: instanciaId,
      telefone_remoto: phoneToStore,
      conteudo: texto,
      direcao,
      tipo_conteudo: tipoConteudo,
      timestamp_msg: new Date().toISOString(),
    };
    if (mediaUrl) insertData.media_url = mediaUrl;

    await sb.from("whatsapp_mensagens").insert(insertData);
  } catch (e) {
    console.warn("[IA] Erro ao logar no inbox:", e);
  }
}

// ========== Decide if this response should be media ==========
async function tentarEnviarMidia(
  sb: any, serverUrl: string, instanceToken: string, numero: string,
  instanciaId: string, textoIA: string
): Promise<{ sent: boolean; tipo?: string }> {
  const rand = Math.random();

  // ~10% chance audio, ~10% chance image
  if (rand >= 0.20) return { sent: false };

  const isAudio = rand < 0.10;
  const pasta = isAudio ? "aquecimento" : "aquecimento-imagens";

  const arquivos = await listarMidiaAquecimento(sb, pasta);
  if (arquivos.length === 0) {
    console.log(`[IA] Sem arquivos em ${pasta}, enviando texto`);
    return { sent: false };
  }

  const arquivo = arquivos[Math.floor(Math.random() * arquivos.length)];
  const publicUrl = getPublicUrl(sb, "campaign-audio", `${pasta}/${arquivo}`);
  if (!publicUrl) return { sent: false };

  console.log(`[IA] 🎲 Sorteou ${isAudio ? "áudio" : "imagem"}: ${arquivo}`);

  let ok: boolean;
  let tipoConteudo: string;
  let descricao: string;

  if (isAudio) {
    ok = await enviarAudioUAZAPI(serverUrl, instanceToken, numero, publicUrl);
    tipoConteudo = "audio";
    descricao = `🎙️ Áudio enviado`;
  } else {
    ok = await enviarImagemUAZAPI(serverUrl, instanceToken, numero, publicUrl, textoIA.length < 80 ? textoIA : undefined);
    tipoConteudo = "imagem";
    descricao = `📷 Imagem enviada`;
  }

  if (ok) {
    await logToInbox(sb, instanciaId, numero, descricao, "saida", tipoConteudo, publicUrl);
    return { sent: true, tipo: tipoConteudo };
  }

  return { sent: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const sb = getSupabaseAdmin();

    // ========== Iniciar conversa com IA ==========
    if (action === "iniciar-conversa") {
      const {
        instancia_origem_id, instancia_destino_id,
        server_url, instance_token, numero_destino,
        numero_origem, dest_server_url, dest_instance_token,
      } = body;

      if (!instancia_origem_id || !instancia_destino_id) {
        return json({ error: "instancia_origem_id e instancia_destino_id obrigatórios" }, 400);
      }

      const duasHorasAtras = new Date(Date.now() - 2 * 3600000).toISOString();
      const { data: recente } = await sb
        .from("whatsapp_conversas_ia")
        .select("id")
        .or(`and(instancia_origem_id.eq.${instancia_origem_id},instancia_destino_id.eq.${instancia_destino_id}),and(instancia_origem_id.eq.${instancia_destino_id},instancia_destino_id.eq.${instancia_origem_id})`)
        .gte("ultima_msg_em", duasHorasAtras)
        .limit(1)
        .maybeSingle();

      if (recente) {
        console.log(`[IA] Cooldown ativo para par, pulando.`);
        return json({ started: false, reason: "cooldown" });
      }

      const mensagemInicial = await gerarMensagemInicial();

      const maxTrocas = 4 + Math.floor(Math.random() * 5); // 4-8 trocas (realistic short conversation)
      const { data: conversa, error: convError } = await sb
        .from("whatsapp_conversas_ia")
        .insert({
          instancia_origem_id, instancia_destino_id,
          max_trocas: maxTrocas,
          historico: [{ role: "enviada", content: mensagemInicial, ts: new Date().toISOString() }],
          total_trocas: 1,
          ultima_msg_em: new Date().toISOString(),
        })
        .select().single();

      if (convError) {
        console.error("[IA] Erro ao criar conversa:", convError);
        return json({ error: "Erro ao criar conversa" }, 500);
      }

      // Ensure contacts exist on both sides
      if (numero_destino && numero_origem) {
        const cleanDest = numero_destino.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
        const cleanOrig = numero_origem.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
        const suffDest = cleanDest.replace(/^55/, "").slice(-8);
        const suffOrig = cleanOrig.replace(/^55/, "").slice(-8);

        const [{ data: origInst }, { data: destInst }] = await Promise.all([
          sb.from("user_whatsapp_instances").select("nome").eq("id", instancia_origem_id).single(),
          sb.from("user_whatsapp_instances").select("nome").eq("id", instancia_destino_id).single(),
        ]);
        const nomeOrig = origInst?.nome || cleanOrig;
        const nomeDest = destInst?.nome || cleanDest;

        const { data: c1 } = await sb.from("whatsapp_contatos")
          .select("id").eq("instancia_id", instancia_origem_id)
          .or(`telefone.eq.${cleanDest},telefone.ilike.%${suffDest}`)
          .maybeSingle();
        if (!c1) {
          await sb.from("whatsapp_contatos").insert({
            instancia_id: instancia_origem_id, telefone: cleanDest, nome: nomeDest,
          });
        }

        const { data: c2 } = await sb.from("whatsapp_contatos")
          .select("id").eq("instancia_id", instancia_destino_id)
          .or(`telefone.eq.${cleanOrig},telefone.ilike.%${suffOrig}`)
          .maybeSingle();
        if (!c2) {
          await sb.from("whatsapp_contatos").insert({
            instancia_id: instancia_destino_id, telefone: cleanOrig, nome: nomeOrig,
          });
        }

        await Promise.all([
          salvarContatoUAZAPI(server_url, instance_token, cleanDest, nomeDest),
          dest_server_url && dest_instance_token
            ? salvarContatoUAZAPI(dest_server_url, dest_instance_token, cleanOrig, nomeOrig)
            : Promise.resolve(),
        ]);
      }

      // Send initial message (may be media ~20% of the time)
      if (server_url && instance_token && numero_destino) {
        // Send typing indicator before first message
        await enviarTypingIndicator(server_url, instance_token, numero_destino, mensagemInicial.length);
        
        let sentAsMedia = false;
        const mediaResult = await tentarEnviarMidia(sb, server_url, instance_token, numero_destino, instancia_origem_id, mensagemInicial);
        sentAsMedia = mediaResult.sent;

        if (!sentAsMedia) {
          const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, mensagemInicial, { instancia_origem_id, instancia_destino_id });
          if (sent) {
            await logToInbox(sb, instancia_origem_id, numero_destino, mensagemInicial, "saida");
          }
        }

        await sb.from("whatsapp_aquecimento_interacoes").insert({
          instancia_origem_id, instancia_destino_id,
          tipo: mediaResult.sent ? (mediaResult.tipo || "texto") : "texto",
          conteudo: mensagemInicial,
          status: "ENVIADO", enviado_em: new Date().toISOString(),
          tipo_interacao: "mensagem",
        });

        const delayMs = humanizedDelay();
        console.log(`[IA] 🔄 ${instancia_destino_id} responderá em ${Math.round(delayMs / 1000)}s`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            action: "gerar-resposta",
            mensagem: mensagemInicial,
            instancia_origem_id: instancia_destino_id,
            instancia_destino_id: instancia_origem_id,
            delay_ms: delayMs,
            server_url: dest_server_url,
            instance_token: dest_instance_token,
            numero_destino: numero_origem,
          }),
        }).catch(err => console.error("[IA] Erro ao disparar resposta:", err));
      }

      console.log(`[IA] 🆕 Conversa iniciada: ${conversa.id} (max ${maxTrocas} trocas)`);
      return json({ started: true, conversa_id: conversa.id, mensagem: mensagemInicial });
    }

    // ========== Gerar resposta (chain) ==========
    if (action === "gerar-resposta") {
      const {
        mensagem, instancia_origem_id, instancia_destino_id,
        delay_ms, server_url, instance_token, numero_destino,
      } = body;

      if (!mensagem || !instancia_origem_id || !instancia_destino_id) {
        return json({ error: "campos obrigatórios faltando" }, 400);
      }

      const delayMs = delay_ms || 0;
      if (delayMs > 0) {
        console.log(`[IA] Aguardando ${Math.round(delayMs / 1000)}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const LIMITE_DIARIO_REAL = 15;
      const { data: instAquec } = await sb
        .from("whatsapp_aquecimento_instancias")
        .select("id, interacoes_hoje, interacoes_total")
        .eq("instancia_id", instancia_origem_id)
        .maybeSingle();

      if (instAquec && instAquec.interacoes_hoje >= LIMITE_DIARIO_REAL) {
        console.log(`[IA] 🛑 Instância ${instancia_origem_id} atingiu limite diário (${instAquec.interacoes_hoje}/${LIMITE_DIARIO_REAL}). Finalizando conversa.`);
        const { data: convToFinish } = await sb
          .from("whatsapp_conversas_ia")
          .select("id")
          .or(`and(instancia_origem_id.eq.${instancia_origem_id},instancia_destino_id.eq.${instancia_destino_id}),and(instancia_origem_id.eq.${instancia_destino_id},instancia_destino_id.eq.${instancia_origem_id})`)
          .eq("status", "ATIVA")
          .maybeSingle();
        if (convToFinish) {
          await sb.from("whatsapp_conversas_ia").update({ status: "FINALIZADA" }).eq("id", convToFinish.id);
        }
        return json({ responded: false, reason: "daily_limit_reached" });
      }

      const { data: conversa } = await sb
        .from("whatsapp_conversas_ia")
        .select("*")
        .or(`and(instancia_origem_id.eq.${instancia_origem_id},instancia_destino_id.eq.${instancia_destino_id}),and(instancia_origem_id.eq.${instancia_destino_id},instancia_destino_id.eq.${instancia_origem_id})`)
        .eq("status", "ATIVA")
        .order("inicio_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conversa) {
        console.log("[IA] Nenhuma conversa ativa encontrada.");
        return json({ responded: false, reason: "no_conversation" });
      }

      if (conversa.total_trocas >= conversa.max_trocas) {
        const historicoArr = (conversa.historico || []) as any[];
        const historicoTexto = historicoArr.slice(-10)
          .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`).join("\n");

        const fraseEncerramento = await chamarIA(mensagem, historicoTexto, conversa.total_trocas, conversa.max_trocas, { instancia_origem_id, instancia_destino_id, numero_destino });

        const novoHistorico = [
          ...historicoArr,
          { role: "recebida", content: mensagem, ts: new Date().toISOString() },
          { role: "enviada", content: fraseEncerramento, ts: new Date().toISOString() },
        ];
        await sb.from("whatsapp_conversas_ia").update({
          status: "FINALIZADA", total_trocas: conversa.total_trocas + 1,
          ultima_msg_em: new Date().toISOString(), historico: novoHistorico,
        }).eq("id", conversa.id);

        if (server_url && instance_token && numero_destino) {
          const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, fraseEncerramento, { instancia_origem_id, instancia_destino_id });
          if (sent) {
            await logToInbox(sb, instancia_origem_id, numero_destino, fraseEncerramento, "saida");
          }
        }

        console.log(`[IA] 🏁 Conversa ${conversa.id} finalizada após ${conversa.total_trocas + 1} trocas`);
        return json({ responded: true, resposta: fraseEncerramento, finalizada: true });
      }

      // Backup: save contacts on first response
      if (conversa.total_trocas <= 1 && server_url && instance_token && numero_destino) {
        try {
          const { data: origInst } = await sb.from("user_whatsapp_instances")
            .select("nome, server_url, instance_token").eq("id", instancia_origem_id).single();
          const { data: destInst } = await sb.from("user_whatsapp_instances")
            .select("nome, server_url, instance_token").eq("id", instancia_destino_id).single();
          
          if (origInst && destInst) {
            const cleanDest = numero_destino.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
            const origPhone = origInst.nome?.match(/^\d+/)?.[0] || "";
            const nomeOrig = origInst.nome || origPhone;
            const nomeDest = destInst.nome || cleanDest;
            
            await salvarContatoUAZAPI(server_url, instance_token, cleanDest, nomeDest);
            if (origPhone && destInst.server_url && destInst.instance_token) {
              await salvarContatoUAZAPI(destInst.server_url, destInst.instance_token, `55${origPhone}`, nomeOrig);
            }
          }
        } catch (e) {
          console.warn("[IA] Backup contato erro:", e);
        }
      }

      // Generate response
      const historicoArr = (conversa.historico || []) as any[];
      const historicoTexto = historicoArr.slice(-10)
        .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`).join("\n");

      const resposta = await chamarIA(mensagem, historicoTexto, conversa.total_trocas, conversa.max_trocas, { instancia_origem_id, instancia_destino_id, numero_destino });

      const novoHistorico = [
        ...historicoArr,
        { role: "recebida", content: mensagem, ts: new Date().toISOString() },
        { role: "enviada", content: resposta, ts: new Date().toISOString() },
      ];
      const novaTroca = conversa.total_trocas + 1;

      await sb.from("whatsapp_conversas_ia").update({
        total_trocas: novaTroca,
        ultima_msg_em: new Date().toISOString(),
        historico: novoHistorico,
      }).eq("id", conversa.id);

      if (instAquec) {
        await sb.from("whatsapp_aquecimento_instancias").update({
          interacoes_hoje: (instAquec.interacoes_hoje || 0) + 1,
          interacoes_total: (instAquec.interacoes_total || 0) + 1,
          ultima_interacao: new Date().toISOString(),
        }).eq("id", instAquec.id);
      }

      // Send message — try media first (~20%), fallback to text
      if (server_url && instance_token && numero_destino) {
        // Send typing indicator before each response
        await enviarTypingIndicator(server_url, instance_token, numero_destino, resposta.length);
        
        const mediaResult = await tentarEnviarMidia(sb, server_url, instance_token, numero_destino, instancia_origem_id, resposta);
        
        if (!mediaResult.sent) {
          const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, resposta, { instancia_origem_id, instancia_destino_id });
          if (sent) {
            await logToInbox(sb, instancia_origem_id, numero_destino, resposta, "saida");
          }
        }
      }

      // Chain: trigger other side to respond
      if (novaTroca < conversa.max_trocas) {
        const outroLado = instancia_origem_id === conversa.instancia_origem_id
          ? conversa.instancia_destino_id : conversa.instancia_origem_id;
        const esteLado = instancia_origem_id;

        const { data: outroInst } = await sb
          .from("user_whatsapp_instances")
          .select("id, server_url, instance_token, nome")
          .eq("id", outroLado)
          .eq("ativo", true)
          .single();

        if (outroInst) {
          const { data: esteInst } = await sb
            .from("user_whatsapp_instances")
            .select("nome")
            .eq("id", esteLado)
            .single();

          const estePhone = esteInst?.nome?.match(/^\d+/)?.[0] || "";

          if (estePhone) {
            const delayNext = humanizedDelay();
            console.log(`[IA] 🔄 Cadeia: ${outroInst.nome} responderá em ${Math.round(delayNext / 1000)}s`);

            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

            fetch(`${supabaseUrl}/functions/v1/whatsapp-ia-responder`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
              body: JSON.stringify({
                action: "gerar-resposta",
                mensagem: resposta,
                instancia_origem_id: outroLado,
                instancia_destino_id: esteLado,
                delay_ms: delayNext,
                server_url: outroInst.server_url,
                instance_token: outroInst.instance_token,
                numero_destino: `55${estePhone}@s.whatsapp.net`,
              }),
            }).catch(err => console.error("[IA] Erro cadeia:", err));
          }
        }
      } else {
        console.log(`[IA] 🏁 Conversa ${conversa.id} atingiu limite (${novaTroca}/${conversa.max_trocas})`);
      }

      return json({ responded: true, resposta, troca: novaTroca, maxTrocas: conversa.max_trocas });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[IA-RESPONDER] Erro:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
