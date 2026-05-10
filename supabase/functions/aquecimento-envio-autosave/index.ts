// Aquecimento Externo Auto-Save - sem IA, custo zero por envio
// Prioriza envios para números âncora (configurável) + pool de contatos externos
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { salvarContatoAgendaCacheado } from "../_shared/agenda-contatos.ts";
import { notificarAdmin } from "../_shared/notificar-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Números âncora (destinos prioritários — sempre online, respondem manualmente)
const ANCORAS_PRIORITARIAS = [
  "5562991672674",
  "5562981810202",
  "5562981079590",
  "5562981865213",
  "5562982183144",
  "5562982458447",
  "5562981079569",
  "5562981727082",
];

const DEFAULT_ANCORA_PROBABILITY = 1.0;

// Limites reduzidos (CRISE 2026) — chips conservadores enquanto taxa de resposta < 25%
function limiteDiarioPorFase(fase: number): number {
  if (fase <= 2) return 3;
  if (fase <= 4) return 6;
  return 10;
}

const MENSAGENS = [
  "Oi", "Olá", "Bom dia", "Boa tarde", "Boa noite",
  "E aí", "Salve", "Tudo bem?", "Tudo certo?", "Tudo bom?",
  "Como vai?", "Beleza?", "Oi, tudo bem?", "Olá, tudo bem?",
  "Bom dia!", "Boa tarde!", "Oii", "E aí, beleza?",
  "Tudo joia?", "Tudo tranquilo?", "Como está?", "Oie",
  "Eai", "Opa", "Opa, tudo bem?", "Salve salve",
  "Tudo na paz?", "E aí, tudo certo?", "Boa!", "Olá!",
  "Hey, tudo joia? 👋", "Coe, firmeza?", "Bão?",
  "Fala chefe", "E aí, tranquilo?", "Suave?",
  "Oi, quanto tempo!", "Lembrou de mim?", "Passando pra dar um oi 👋",
  "Só passando pra dizer oi", "Tudo na paz?", "Firme e forte?",
  "E aí, novidades?", "Como andam as coisas?", "Tudo em cima? 👍",
  "Salve, camarada", "Opa, belezinha?", "Fala parceiro",
  "Oi, espero que esteja bem 🙂", "Só um oi rápido",
];

function pickMsg(): string {
  return MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)];
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // TRAVA GLOBAL: aquecimento entre números suspenso
    const { data: pausaRow } = await supabase
      .from("whatsapp_aquecimento_config")
      .select("valor")
      .eq("chave", "aquecimento_pausado")
      .maybeSingle();
    if (pausaRow?.valor === true || pausaRow?.valor === "true") {
      return json({ message: "Aquecimento pausado globalmente", paused: true });
    }

    // Lê config (kill-switch + proporção âncora)
    const { data: cfg } = await supabase
      .from("aquecimento_autosave_config")
      .select("ancora_probability, ativo")
      .eq("id", 1)
      .maybeSingle();

    if (cfg && cfg.ativo === false) {
      return json({ message: "Auto-save desativado via config", skipped: true });
    }
    const ancoraProb = typeof cfg?.ancora_probability === "number" ? cfg.ancora_probability : DEFAULT_ANCORA_PROBABILITY;

    // Horário comercial (07-21h BRT) e pausa de almoço (12-14h BRT)
    const now = new Date();
    const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = sp.getHours();
    const dow = sp.getDay();
    if (hour < 7 || hour >= 21) return json({ message: "Fora do horário", skipped: true });
    if (hour >= 12 && hour < 14) return json({ message: "Pausa de almoço", skipped: true });
    const fatorDia = dow === 0 ? 0.4 : dow === 6 ? 0.6 : 1.0;

    const { data: aquecInsts } = await supabase
      .from("whatsapp_aquecimento_instancias")
      .select("id, instancia_id, fase, status")
      .in("status", ["EM_AQUECIMENTO", "AQUECIDO"]);

    if (!aquecInsts?.length) return json({ message: "Sem instâncias ativas", skipped: true });

    const ids = aquecInsts.map((i: any) => i.instancia_id);
    const { data: insts } = await supabase
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, ativo")
      .in("id", ids)
      .eq("ativo", true);

    const instMap = new Map((insts || []).map((i: any) => [i.id, i]));
    const inicioDia = new Date(sp); inicioDia.setHours(0, 0, 0, 0);
    const inicioDiaIso = inicioDia.toISOString();
    const corte30dIso = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const corte7dIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const tasks = aquecInsts.map(async (aquec: any) => {
      const inst = instMap.get(aquec.instancia_id);
      if (!inst) return { status: "sem_instancia" };

      const limiteBase = limiteDiarioPorFase(aquec.fase || 1);
      const limite = Math.max(1, Math.floor(limiteBase * fatorDia));

      const { count: enviosHoje } = await supabase
        .from("aquecimento_envios_autosave")
        .select("id", { count: "exact", head: true })
        .eq("instancia_id", aquec.instancia_id)
        .eq("status", "enviado")
        .gte("enviado_em", inicioDiaIso);

      if ((enviosHoje || 0) >= limite) {
        return { instancia: inst.nome, status: "limite_atingido", enviosHoje };
      }

      const useAncora = Math.random() < ancoraProb;
      let numeroFinal: string | null = null;
      let contatoId: string | null = null;
      let nomeContato: string | null = null;
      let origem: "ancora" | "pool" = "ancora";

      if (useAncora) {
        const { data: usosAncora } = await supabase
          .from("aquecimento_envios_autosave")
          .select("numero_destino")
          .eq("instancia_id", aquec.instancia_id)
          .gte("enviado_em", corte7dIso)
          .in("numero_destino", ANCORAS_PRIORITARIAS);

        const counts = new Map<string, number>();
        ANCORAS_PRIORITARIAS.forEach((n) => counts.set(n, 0));
        (usosAncora || []).forEach((r: any) => {
          if (r.numero_destino) counts.set(r.numero_destino, (counts.get(r.numero_destino) || 0) + 1);
        });
        const ordenados = [...counts.entries()].sort((a, b) => a[1] - b[1] || Math.random() - 0.5);
        numeroFinal = ordenados[0][0];
        nomeContato = `Âncora ${numeroFinal.slice(-4)}`;
        origem = "ancora";
      } else {
        const { data: usadosRecentes } = await supabase
          .from("aquecimento_envios_autosave")
          .select("contato_id")
          .eq("instancia_id", aquec.instancia_id)
          .gte("enviado_em", corte30dIso)
          .not("contato_id", "is", null);

        const excluir = new Set((usadosRecentes || []).map((u: any) => u.contato_id));

        const { data: candidatos } = await supabase
          .from("aquecimento_contatos_autosave")
          .select("id, numero, nome, total_usos")
          .eq("ativo", true)
          .order("ultimo_uso_em", { ascending: true, nullsFirst: true })
          .limit(50);

        const contato = (candidatos || []).find((c: any) => !excluir.has(c.id));
        if (!contato) {
          const ancora = ANCORAS_PRIORITARIAS[Math.floor(Math.random() * ANCORAS_PRIORITARIAS.length)];
          numeroFinal = ancora;
          nomeContato = `Âncora ${ancora.slice(-4)}`;
          origem = "ancora";
        } else {
          const numeroLimpo = String(contato.numero).replace(/\D/g, "");
          numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;
          contatoId = contato.id;
          nomeContato = contato.nome || `Contato ${numeroFinal}`;
          origem = "pool";
        }
      }

      if (!numeroFinal) {
        // registra falha de seleção
        await supabase.from("aquecimento_envios_autosave").insert({
          instancia_id: aquec.instancia_id,
          numero_destino: null,
          mensagem_enviada: "(sem destino)",
          status: "erro",
          erro_detalhe: "sem_destino",
          origem,
        });
        return { instancia: inst.nome, status: "sem_destino" };
      }

      const mensagem = pickMsg();

      // ⚡ PRÉ-CHECK CONEXÃO: evita martelar chips desconectados
      try {
        const ctrlChk = new AbortController();
        const tChk = setTimeout(() => ctrlChk.abort(), 8000);
        const chk = await fetch(`${inst.server_url}/instance/status`, {
          method: "GET",
          headers: { token: inst.instance_token },
          signal: ctrlChk.signal,
        });
        clearTimeout(tChk);
        const chkText = await chk.text();
        const lower = chkText.toLowerCase();
        const conectado = chk.ok && (lower.includes('"connected":true') || lower.includes('"connected"') === false ? lower.includes('"status":"connected"') || lower.includes('"status":"open"') || lower.includes('"status":"online"') : true);
        const desconectado = lower.includes('disconnected') || lower.includes('not reconnectable') || lower.includes('"status":"closed"') || lower.includes('"status":"disconnected"');
        if (desconectado || !chk.ok) {
          await supabase.from("aquecimento_envios_autosave").insert({
            instancia_id: aquec.instancia_id,
            numero_destino: numeroFinal,
            mensagem_enviada: mensagem,
            status: "skipped_disconnected",
            erro_detalhe: chkText.substring(0, 250),
            origem,
          });
          await supabase.from("whatsapp_chip_eventos").insert({
            instancia_id: aquec.instancia_id,
            tipo_evento: "desconexao",
            detalhe: "pre-check status",
          });
          // Auto-pause inteligente: 2+ desconexões em 24h → pausa 72h
          const corte24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const { count: quedasRecentes } = await supabase
            .from("whatsapp_chip_eventos")
            .select("id", { count: "exact", head: true })
            .eq("instancia_id", aquec.instancia_id)
            .eq("tipo_evento", "desconexao")
            .gte("registrado_em", corte24h);
          const updates: any = { status: "PAUSADO", pausado_por_silencio: false, updated_at: new Date().toISOString() };
          if ((quedasRecentes || 0) >= 2) {
            updates.pausado_ate = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
            updates.pausado_motivo = `auto-pause 72h: ${quedasRecentes} quedas em 24h`;
          }
          await supabase.from("whatsapp_aquecimento_instancias")
            .update(updates).eq("instancia_id", aquec.instancia_id);
          // Notifica admin (idempotência por chip+dia)
          const dataChave = new Date().toISOString().slice(0, 10);
          notificarAdmin(supabase, {
            tipo: "chip_desconectado",
            mensagem: `📡 Chip *${inst.nome}* caiu (quedas 24h: ${quedasRecentes || 1})${updates.pausado_ate ? "\n⏸️ Auto-pausa 72h aplicada" : ""}`,
            chaveIdempotencia: `${aquec.instancia_id}_${dataChave}`,
            forcarFlag: "notificar_chip_desconectado",
          }).catch(() => {});
          return { instancia: inst.nome, status: "skipped_disconnected" };
        }
      } catch (_) { /* se check falhar, segue tentativa normal */ }

      try {
        try {
          await salvarContatoAgendaCacheado(
            supabase, aquec.instancia_id, inst.server_url, inst.instance_token,
            numeroFinal, nomeContato || `Contato ${numeroFinal}`,
          );
        } catch (_) { /* não bloqueia envio */ }

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);

        const sendRes = await fetch(`${inst.server_url}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
          body: JSON.stringify({ number: numeroFinal, text: mensagem }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        const respText = await sendRes.text();

        if (sendRes.ok) {
          await supabase.from("aquecimento_envios_autosave").insert({
            instancia_id: aquec.instancia_id,
            contato_id: contatoId,
            numero_destino: numeroFinal,
            mensagem_enviada: mensagem,
            status: "enviado",
            origem,
          });

          // Incrementa contador de silêncio (resposta zera no webhook)
          const { data: aquecRow } = await supabase
            .from("whatsapp_aquecimento_instancias")
            .select("id, mensagens_sem_resposta")
            .eq("instancia_id", aquec.instancia_id)
            .maybeSingle();
          if (aquecRow) {
            const novo = (aquecRow.mensagens_sem_resposta || 0) + 1;
            const updates: any = { mensagens_sem_resposta: novo };
            if (novo >= 20) {
              updates.status = "PAUSADO";
              updates.pausado_por_silencio = true;
              updates.updated_at = new Date().toISOString();
            }
            await supabase.from("whatsapp_aquecimento_instancias").update(updates).eq("id", aquecRow.id);
            if (novo >= 20) {
              const dataChave = new Date().toISOString().slice(0, 10);
              notificarAdmin(supabase, {
                tipo: "chip_pausado_silencio",
                mensagem: `⏸️ Chip *${inst.nome}* pausado por silêncio (20 msgs sem resposta).\nReative manualmente após verificar saúde.`,
                chaveIdempotencia: `${aquec.instancia_id}_${dataChave}`,
                forcarFlag: "notificar_chip_pausado",
              }).catch(() => {});
            }
          }

          if (contatoId) {
            const { data: c } = await supabase
              .from("aquecimento_contatos_autosave")
              .select("total_usos")
              .eq("id", contatoId)
              .maybeSingle();
            await supabase
              .from("aquecimento_contatos_autosave")
              .update({
                ultimo_uso_em: new Date().toISOString(),
                respondeu_ultima: false,
                total_usos: ((c as any)?.total_usos || 0) + 1,
              })
              .eq("id", contatoId);
          }

          return { instancia: inst.nome, destino: numeroFinal, origem, status: "enviado", msg: mensagem };
        } else {
          const desc = respText.toLowerCase().includes('not reconnectable') || respText.toLowerCase().includes('disconnected');
          await supabase.from("aquecimento_envios_autosave").insert({
            instancia_id: aquec.instancia_id,
            contato_id: contatoId,
            numero_destino: numeroFinal,
            mensagem_enviada: mensagem,
            status: desc ? "skipped_disconnected" : "erro",
            erro_detalhe: respText.substring(0, 250),
            origem,
          });
          if (desc) {
            await supabase.from("whatsapp_aquecimento_instancias")
              .update({ status: "PAUSADO", updated_at: new Date().toISOString() })
              .eq("instancia_id", aquec.instancia_id);
          }
          return { instancia: inst.nome, destino: numeroFinal, origem, status: desc ? "skipped_disconnected" : "erro", detalhe: respText.substring(0, 150) };
        }
      } catch (e) {
        // ⛔ REGISTRA EXCEÇÃO
        await supabase.from("aquecimento_envios_autosave").insert({
          instancia_id: aquec.instancia_id,
          contato_id: contatoId,
          numero_destino: numeroFinal,
          mensagem_enviada: mensagem,
          status: "exception",
          erro_detalhe: String(e).substring(0, 250),
          origem,
        });
        return { instancia: inst.nome, status: "exception", erro: String(e).substring(0, 150) };
      }
    });

    const resultados = await Promise.all(tasks);
    const enviados = resultados.filter((r: any) => r.status === "enviado").length;
    const enviadosAncora = resultados.filter((r: any) => r.status === "enviado" && r.origem === "ancora").length;
    const enviadosPool = resultados.filter((r: any) => r.status === "enviado" && r.origem === "pool").length;
    const erros = resultados.filter((r: any) => r.status === "erro" || r.status === "exception").length;

    return json({
      success: true,
      enviados, enviadosAncora, enviadosPool, erros,
      ancora_probability: ancoraProb,
      total_instancias: aquecInsts.length,
      resultados,
    });
  } catch (err) {
    console.error("[AUTOSAVE]", err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
