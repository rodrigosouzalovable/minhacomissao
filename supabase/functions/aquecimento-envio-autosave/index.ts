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
    // Bloqueio de horário/dia (mesma regra do aquecimento principal)
    const now = new Date();
    const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = sp.getHours();
    const dow = sp.getDay();
    if (hour < 7 || hour >= 21 || dow === 0) {
      return json({ message: "Fora do horário ou domingo", skipped: true });
    }

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

    let enviados = 0;
    const resultados: any[] = [];

    for (const aquec of aquecInsts) {
      const inst = instMap.get(aquec.instancia_id);
      if (!inst) continue;

      const limite = limiteDiarioPorFase(aquec.fase || 1);

      // Quantos enviou hoje
      const { count: enviosHoje } = await supabase
        .from("aquecimento_envios_autosave")
        .select("id", { count: "exact", head: true })
        .eq("instancia_id", aquec.instancia_id)
        .gte("enviado_em", inicioDiaIso);

      if ((enviosHoje || 0) >= limite) {
        resultados.push({ instancia: inst.nome, status: "limite_atingido", enviosHoje });
        continue;
      }

      // Sortear: 60% de chance de enviar nesta rodada (espalhar ao longo do dia)
      if (Math.random() > 0.6) {
        resultados.push({ instancia: inst.nome, status: "skip_aleatorio" });
        continue;
      }

      // Contatos usados por esta instância nos últimos 30 dias
      const { data: usadosRecentes } = await supabase
        .from("aquecimento_envios_autosave")
        .select("contato_id")
        .eq("instancia_id", aquec.instancia_id)
        .gte("enviado_em", corte30dIso);

      const excluir = new Set((usadosRecentes || []).map((u: any) => u.contato_id));

      // Buscar candidato (round-robin por ultimo_uso_em ASC, NULLS FIRST)
      let q = supabase
        .from("aquecimento_contatos_autosave")
        .select("id, numero, nome")
        .eq("ativo", true)
        .order("ultimo_uso_em", { ascending: true, nullsFirst: true })
        .limit(50);

      const { data: candidatos } = await q;
      const contato = (candidatos || []).find((c: any) => !excluir.has(c.id));

      if (!contato) {
        resultados.push({ instancia: inst.nome, status: "sem_contato_disponivel" });
        continue;
      }

      const mensagem = pickMsg();
      const numeroLimpo = String(contato.numero).replace(/\D/g, "");
      const numeroFinal = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

      // Enviar via UAZAPI direto (mais simples, sem passar por send-whatsapp que tem regras de cliente)
      try {
        const sendRes = await fetch(`${inst.server_url}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: inst.instance_token,
          },
          body: JSON.stringify({
            number: numeroFinal,
            text: mensagem,
          }),
        });

        const ok = sendRes.ok;
        const respText = await sendRes.text();

        if (ok) {
          // Log envio + atualiza contato
          await supabase.from("aquecimento_envios_autosave").insert({
            instancia_id: aquec.instancia_id,
            contato_id: contato.id,
            mensagem_enviada: mensagem,
          });
          await supabase
            .from("aquecimento_contatos_autosave")
            .update({
              ultimo_uso_em: new Date().toISOString(),
              total_usos: ((contato as any).total_usos || 0) + 1,
              respondeu_ultima: false,
            })
            .eq("id", contato.id);

          enviados++;
          resultados.push({ instancia: inst.nome, contato: contato.numero, status: "enviado", msg: mensagem });
        } else {
          resultados.push({ instancia: inst.nome, contato: contato.numero, status: "erro", detalhe: respText.substring(0, 150) });
        }
      } catch (e) {
        resultados.push({ instancia: inst.nome, status: "exception", erro: String(e) });
      }

      // Delay pequeno entre instâncias para não martelar
      await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
    }

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
