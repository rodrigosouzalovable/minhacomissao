import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEMAS_CONVERSA = [
  "futebol brasileiro, campeonato, jogos recentes",
  "clima e tempo, calor, chuva, previsão",
  "comida, receitas, restaurantes, o que almoçou",
  "filmes e séries que assistiu ou quer assistir",
  "trabalho, rotina, produtividade",
  "fim de semana, planos, lazer",
  "música, shows, festivais",
  "tecnologia, celular, apps, internet",
  "viagens, lugares que quer conhecer",
  "notícias do dia, coisas que viu na internet",
  "família, filhos, parentes",
  "exercícios, academia, saúde",
  "pets, animais de estimação",
  "jogos, videogame, entretenimento",
  "memes, coisas engraçadas que viu",
  "compras, promoções, preços",
  "carros, motos, trânsito",
  "feriados, datas comemorativas",
];

const FALLBACK_RESPOSTAS = [
  "Kkk verdade! 😂", "Sim sim, com certeza 👍", "Ah legal, massa!",
  "Entendi haha", "Boa! 🙏", "Aham, concordo", "Pois é né 😄",
  "Haha boa!", "Show de bola 👍", "Tá certo!", "Demais hein! 😁",
  "Kkkkk", "Verdade, penso igual", "Top! 🔥",
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
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

async function chamarIA(mensagem: string, historico: string, totalTrocas: number, maxTrocas: number): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[IA] LOVABLE_API_KEY não configurado, usando fallback");
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }

  const systemPrompt = buildSystemPrompt(totalTrocas, maxTrocas);
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  if (historico) {
    messages.push({ role: "user", content: `Histórico recente da conversa:\n${historico}` });
    messages.push({ role: "assistant", content: "Ok, entendi o contexto. Vou continuar naturalmente." });
  }

  messages.push({ role: "user", content: mensagem });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[IA] Gateway ${response.status}: ${errText.substring(0, 200)}`);
      return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
    }

    const data = await response.json();
    let resposta = (data.choices?.[0]?.message?.content || "").trim();
    resposta = resposta.replace(/^["']|["']$/g, "").trim();
    if (!resposta || resposta.length < 2) {
      return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
    }
    if (resposta.length > 200) {
      resposta = resposta.substring(0, 200).replace(/\s\S*$/, "");
    }
    console.log(`[IA] Resposta (troca ${totalTrocas + 1}/${maxTrocas}): "${resposta}"`);
    return resposta;
  } catch (err) {
    console.error("[IA] Erro:", err);
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }
}

async function gerarMensagemInicial(): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const tema = TEMAS_CONVERSA[Math.floor(Math.random() * TEMAS_CONVERSA.length)];

  if (!apiKey) {
    return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um brasileiro comum no WhatsApp. Gere UMA mensagem curta e casual para iniciar uma conversa com um amigo sobre: ${tema}. 
Seja informal, use gírias, abreviações. Pode usar emoji mas com moderação. 
Exemplos de tom: "e aí mano, viu o jogo ontem?", "cara tô morrendo de calor hj", "vc viu aquele filme novo?", "mano q fome, oq vc almoçou?".
Responda APENAS com a mensagem, sem explicações.`,
          },
          { role: "user", content: "Gere a mensagem inicial." },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return FALLBACK_RESPOSTAS[Math.floor(Math.random() * FALLBACK_RESPOSTAS.length)];

    const data = await response.json();
    let msg = (data.choices?.[0]?.message?.content || "").trim();
    msg = msg.replace(/^["']|["']$/g, "").trim();
    if (!msg || msg.length < 2) return "e aí, tudo bem? 😊";
    if (msg.length > 150) msg = msg.substring(0, 150);
    console.log(`[IA] Mensagem inicial gerada (tema: ${tema}): "${msg}"`);
    return msg;
  } catch {
    return "e aí, tudo bem? 😊";
  }
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

async function enviarMensagemUAZAPI(serverUrl: string, instanceToken: string, numero: string, texto: string): Promise<boolean> {
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const endpoints = [`${cleanUrl}/send/text`, `${cleanUrl}/message/sendText`, `${cleanUrl}/sendText`];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: instanceToken },
        body: JSON.stringify({ number: numero, text: texto }),
      });
      if (res.ok) {
        await res.text();
        console.log(`[IA] ✅ Enviada para ${numero}: "${texto}"`);
        return true;
      }
      await res.text();
    } catch (e) {
      console.warn(`[IA] Endpoint ${url} falhou:`, e);
    }
  }
  console.error(`[IA] ❌ Falha ao enviar para ${numero}`);
  return false;
}

async function logToInbox(sb: any, instanciaId: string, telefoneRemoto: string, texto: string, direcao: "saida" | "entrada" = "saida") {
  try {
    const cleanPhone = telefoneRemoto.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
    const phoneSuffix = cleanPhone.replace(/^55/, "").slice(-8);

    // Find existing contact to use their phone format (avoids mismatch with/without "9")
    const { data: contato } = await sb
      .from("whatsapp_contatos")
      .select("id, telefone")
      .eq("instancia_id", instanciaId)
      .or(`telefone.eq.${cleanPhone},telefone.ilike.%${phoneSuffix}`)
      .maybeSingle();

    let phoneToStore = contato?.telefone || cleanPhone;

    // If contact doesn't exist, create it automatically
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

    await sb.from("whatsapp_mensagens").insert({
      instancia_id: instanciaId,
      telefone_remoto: phoneToStore,
      conteudo: texto,
      direcao,
      tipo_conteudo: "texto",
      timestamp_msg: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[IA] Erro ao logar no inbox:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const sb = getSupabaseAdmin();

    // ========== NEW: Iniciar conversa com IA ==========
    if (action === "iniciar-conversa") {
      const {
        instancia_origem_id, instancia_destino_id,
        server_url, instance_token, numero_destino,
        numero_origem, dest_server_url, dest_instance_token,
      } = body;

      if (!instancia_origem_id || !instancia_destino_id) {
        return json({ error: "instancia_origem_id e instancia_destino_id obrigatórios" }, 400);
      }

      // Check cooldown - don't start if there's a recent conversation
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

      // Generate initial message with AI
      const mensagemInicial = await gerarMensagemInicial();

      // Create conversation record
      const maxTrocas = 12 + Math.floor(Math.random() * 7); // 12-18 trocas
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

      // Ensure contacts exist on both sides (DB + phone agenda)
      if (numero_destino && numero_origem) {
        const cleanDest = numero_destino.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
        const cleanOrig = numero_origem.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
        const suffDest = cleanDest.replace(/^55/, "").slice(-8);
        const suffOrig = cleanOrig.replace(/^55/, "").slice(-8);

        // Get instance names for contact naming
        const [{ data: origInst }, { data: destInst }] = await Promise.all([
          sb.from("user_whatsapp_instances").select("nome").eq("id", instancia_origem_id).single(),
          sb.from("user_whatsapp_instances").select("nome").eq("id", instancia_destino_id).single(),
        ]);
        const nomeOrig = origInst?.nome || cleanOrig;
        const nomeDest = destInst?.nome || cleanDest;

        // Contact of destino on origem's inbox
        const { data: c1 } = await sb.from("whatsapp_contatos")
          .select("id").eq("instancia_id", instancia_origem_id)
          .or(`telefone.eq.${cleanDest},telefone.ilike.%${suffDest}`)
          .maybeSingle();
        if (!c1) {
          await sb.from("whatsapp_contatos").insert({
            instancia_id: instancia_origem_id, telefone: cleanDest, nome: nomeDest,
          });
          console.log(`[IA] 📇 Contato ${cleanDest} criado na instância origem`);
        }

        // Contact of origem on destino's inbox
        const { data: c2 } = await sb.from("whatsapp_contatos")
          .select("id").eq("instancia_id", instancia_destino_id)
          .or(`telefone.eq.${cleanOrig},telefone.ilike.%${suffOrig}`)
          .maybeSingle();
        if (!c2) {
          await sb.from("whatsapp_contatos").insert({
            instancia_id: instancia_destino_id, telefone: cleanOrig, nome: nomeOrig,
          });
          console.log(`[IA] 📇 Contato ${cleanOrig} criado na instância destino`);
        }

        // Save contacts on physical phone agenda via UAZAPI
        await Promise.all([
          salvarContatoUAZAPI(server_url, instance_token, cleanDest, nomeDest),
          dest_server_url && dest_instance_token
            ? salvarContatoUAZAPI(dest_server_url, dest_instance_token, cleanOrig, nomeOrig)
            : Promise.resolve(),
        ]);
      }

      // Send the initial message
      if (server_url && instance_token && numero_destino) {
        const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, mensagemInicial);
        if (sent) {
          // Log outgoing message on sender's inbox
          await logToInbox(sb, instancia_origem_id, numero_destino, mensagemInicial, "saida");

          // Log interaction
          await sb.from("whatsapp_aquecimento_interacoes").insert({
            instancia_origem_id, instancia_destino_id,
            tipo: "texto", conteudo: mensagemInicial,
            status: "ENVIADO", enviado_em: new Date().toISOString(),
            tipo_interacao: "mensagem",
          });

          // Schedule the other side to respond after delay
          const delayMs = randomDelay(30000, 60000);
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

      // Wait delay
      const delayMs = delay_ms || 0;
      if (delayMs > 0) {
        console.log(`[IA] Aguardando ${Math.round(delayMs / 1000)}s...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }

      // Check daily limit BEFORE responding
      const LIMITE_DIARIO_REAL = 15;
      const { data: instAquec } = await sb
        .from("whatsapp_aquecimento_instancias")
        .select("id, interacoes_hoje, interacoes_total")
        .eq("instancia_id", instancia_origem_id)
        .maybeSingle();

      if (instAquec && instAquec.interacoes_hoje >= LIMITE_DIARIO_REAL) {
        console.log(`[IA] 🛑 Instância ${instancia_origem_id} atingiu limite diário (${instAquec.interacoes_hoje}/${LIMITE_DIARIO_REAL}). Finalizando conversa.`);
        // Find and finalize the conversation
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

      // Find active conversation
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
        // Generate closing message
        const historicoArr = (conversa.historico || []) as any[];
        const historicoTexto = historicoArr.slice(-10)
          .map((m: any) => `${m.role === "enviada" ? "Eu" : "Amigo"}: ${m.content}`).join("\n");

        const fraseEncerramento = await chamarIA(mensagem, historicoTexto, conversa.total_trocas, conversa.max_trocas);

        // Update conversation as finished
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
          const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, fraseEncerramento);
          if (sent) {
            await logToInbox(sb, instancia_origem_id, numero_destino, fraseEncerramento, "saida");
          }
        }

        console.log(`[IA] 🏁 Conversa ${conversa.id} finalizada após ${conversa.total_trocas + 1} trocas`);
        return json({ responded: true, resposta: fraseEncerramento, finalizada: true });
      }

      // Backup: save contacts on first response if not saved yet
      if (conversa.total_trocas <= 1 && server_url && instance_token && numero_destino) {
        try {
          console.log(`[IA] 🔄 Backup: verificando salvamento de contatos na troca ${conversa.total_trocas}...`);
          const { data: origInst } = await sb.from("user_whatsapp_instances")
            .select("nome, server_url, instance_token").eq("id", instancia_origem_id).single();
          const { data: destInst } = await sb.from("user_whatsapp_instances")
            .select("nome, server_url, instance_token").eq("id", instancia_destino_id).single();
          
          if (origInst && destInst) {
            const cleanDest = numero_destino.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
            const origPhone = origInst.nome?.match(/^\d+/)?.[0] || "";
            const nomeOrig = origInst.nome || origPhone;
            const nomeDest = destInst.nome || cleanDest;
            
            // Save destino contact on origem's phone
            await salvarContatoUAZAPI(server_url, instance_token, cleanDest, nomeDest);
            
            // Save origem contact on destino's phone  
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

      const resposta = await chamarIA(mensagem, historicoTexto, conversa.total_trocas, conversa.max_trocas);

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

      // Increment daily counter for this responding instance
      if (instAquec) {
        await sb.from("whatsapp_aquecimento_instancias").update({
          interacoes_hoje: (instAquec.interacoes_hoje || 0) + 1,
          interacoes_total: (instAquec.interacoes_total || 0) + 1,
          ultima_interacao: new Date().toISOString(),
        }).eq("id", instAquec.id);
      }

      // Send message and log
      if (server_url && instance_token && numero_destino) {
        const sent = await enviarMensagemUAZAPI(server_url, instance_token, numero_destino, resposta);
        if (sent) {
          await logToInbox(sb, instancia_origem_id, numero_destino, resposta, "saida");
        }
      }

      // Chain: trigger the other side to respond back
      if (novaTroca < conversa.max_trocas) {
        // Need to get the other side's details to respond back
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
          // Get phone of current side
          const { data: esteInst } = await sb
            .from("user_whatsapp_instances")
            .select("nome")
            .eq("id", esteLado)
            .single();

          const estePhone = esteInst?.nome?.match(/^\d+/)?.[0] || "";

          if (estePhone) {
            const delayNext = randomDelay(30000, 60000);
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
    return json({ error: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
