// Aquecimento Externo Auto-Save - sem IA, custo zero por envio
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MENSAGENS = [
  "Oi", "Olá", "Bom dia", "Boa tarde", "Boa noite",
  "E aí", "Salve", "Tudo bem?", "Tudo certo?", "Tudo bom?",
  "Como vai?", "Beleza?", "Oi, tudo bem?", "Olá, tudo bem?",
  "Bom dia!", "Boa tarde!", "Oii", "E aí, beleza?",
  "Tudo joia?", "Tudo tranquilo?", "Como está?", "Oie",
  "Eai", "Opa", "Opa, tudo bem?", "Salve salve",
  "Tudo na paz?", "E aí, tudo certo?", "Boa!", "Olá!",
];

function pickMsg(): string {
  return MENSAGENS[Math.floor(Math.random() * MENSAGENS.length)];
}

function limiteDiarioPorFase(fase: number): number {
  if (fase <= 2) return 3;
  if (fase <= 4) return 5;
  return 7;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Horário comercial (07-21h BRT) e pausa de almoço (12-14h BRT)
    const now = new Date();
    const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = sp.getHours();
    const dow = sp.getDay();
    if (hour < 7 || hour >= 21) {
      return json({ message: "Fora do horário", skipped: true });
    }
    if (hour >= 12 && hour < 14) {
      return json({ message: "Pausa de almoço", skipped: true });
    }
    // Fator fim de semana: domingo 40%, sábado 60%, demais 100%
    const fatorDia = dow === 0 ? 0.4 : dow === 6 ? 0.6 : 1.0;

    // Pool ativa
    const { count: poolAtiva } = await supabase
      .from("aquecimento_contatos_autosave")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true);

    if (!poolAtiva || poolAtiva === 0) {
      return json({ message: "Pool vazia", skipped: true });
    }

    // Instâncias em aquecimento
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

    // Processa todas as instâncias EM PARALELO (cada uma é independente)
    // Evita timeout de 150s quando há muitas instâncias
    const tasks = aquecInsts.map(async (aquec: any) => {
      const inst = instMap.get(aquec.instancia_id);
      if (!inst) return { status: "sem_instancia" };

      // Aplica fator fim-de-semana (mín 1) ao limite da fase
      const limiteBase = limiteDiarioPorFase(aquec.fase || 1);
      const limite = Math.max(1, Math.floor(limiteBase * fatorDia));

      const { count: enviosHoje } = await supabase
        .from("aquecimento_envios_autosave")
        .select("id", { count: "exact", head: true })
        .eq("instancia_id", aquec.instancia_id)
        .gte("enviado_em", inicioDiaIso);

      if ((enviosHoje || 0) >= limite) {
        return { instancia: inst.nome, status: "limite_atingido", enviosHoje };
      }

      // Sortear: 70% de chance de enviar nesta rodada (skip 30%)
      if (Math.random() > 0.7) {
        return { instancia: inst.nome, status: "skip_aleatorio" };
      }

      // Contatos usados nos últimos 30 dias
      const { data: usadosRecentes } = await supabase
        .from("aquecimento_envios_autosave")
        .select("contato_id")
        .eq("instancia_id", aquec.instancia_id)
        .gte("enviado_em", corte30dIso);

      const excluir = new Set((usadosRecentes || []).map((u: any) => u.contato_id));

      const { data: candidatos } = await supabase
        .from("aquecimento_contatos_autosave")
        .select("id, numero, nome, total_usos")
        .eq("ativo", true)
        .order("ultimo_uso_em", { ascending: true, nullsFirst: true })
        .limit(50);

      const contato = (candidatos || []).find((c: any) => !excluir.has(c.id));
      if (!contato) {
        return { instancia: inst.nome, status: "sem_contato_disponivel" };
      }

      const mensagem = pickMsg();
      const numeroLimpo = String(contato.numero).replace(/\D/g, "");
      const numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

      try {
        // Timeout de 20s por envio para evitar travamento
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
            contato_id: contato.id,
            mensagem_enviada: mensagem,
          });
          await supabase
            .from("aquecimento_contatos_autosave")
            .update({
              ultimo_uso_em: new Date().toISOString(),
              total_usos: (contato.total_usos || 0) + 1,
              respondeu_ultima: false,
            })
            .eq("id", contato.id);

          return { instancia: inst.nome, contato: contato.numero, status: "enviado", msg: mensagem };
        } else {
          return { instancia: inst.nome, contato: contato.numero, status: "erro", detalhe: respText.substring(0, 150) };
        }
      } catch (e) {
        return { instancia: inst.nome, status: "exception", erro: String(e).substring(0, 150) };
      }
    });

    const resultados = await Promise.all(tasks);
    const enviados = resultados.filter((r: any) => r.status === "enviado").length;

    return json({ success: true, enviados, total_instancias: aquecInsts.length, resultados });
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
