import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sb() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function nowBRT() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatBR(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return "55" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    let tipo: "D-1" | "D0" = body.tipo === "D-1" ? "D-1" : "D0";
    const dryRun = body.dryRun === true;
    const force = body.force === true;

    const brt = nowBRT();
    // Auto-decide tipo by hour if not provided
    if (!body.tipo) {
      const hour = brt.getHours();
      tipo = hour < 12 ? "D0" : "D-1";
    }

    // Sunday block (bypass with force=true for manual tests)
    if (brt.getDay() === 0 && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: "domingo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = sb();

    // Load config
    const { data: config } = await supabase
      .from("notificacoes_config")
      .select("*, instancia:instancia_id(id, server_url, instance_token, ativo)")
      .eq("ativo", true)
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!config || !config.instancia) {
      return new Response(JSON.stringify({ ok: false, error: "Sem instância configurada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Target date
    const target = new Date(brt);
    if (tipo === "D-1") target.setDate(target.getDate() + 1);
    const dataRef = isoDate(target);
    const dataRefLog = isoDate(brt); // log uses today

    // Pagamentos vencendo na dataRef, status pendente, acordo ativo + boleto_enviado false
    const { data: pagamentos, error: errP } = await supabase
      .from("pagamentos")
      .select("id, acordo_id, numero_parcela, data_prevista, valor_parcela, acordos!inner(id, user_id, cliente_nome, cliente_cpf, boleto_enviado, status)")
      .eq("status", "pendente")
      .eq("data_prevista", dataRef)
      .eq("acordos.status", "ativo")
      .eq("acordos.boleto_enviado", false);

    if (errP) throw errP;

    const items = (pagamentos as any[]) || [];
    const results: any[] = [];

    for (const p of items) {
      const userId = p.acordos.user_id as string;

      // Dedup
      const { data: existing } = await supabase
        .from("notificacoes_envios_log")
        .select("id")
        .eq("pagamento_id", p.id)
        .eq("tipo", tipo)
        .eq("data_ref", dataRefLog)
        .maybeSingle();
      if (existing) {
        results.push({ pagamento_id: p.id, skipped: "ja_enviado" });
        continue;
      }

      // Telefone operador
      const { data: tel } = await supabase
        .from("notificacoes_operador_telefone")
        .select("telefone, ativo")
        .eq("user_id", userId)
        .maybeSingle();

      if (!tel?.telefone || !tel.ativo) {
        results.push({ pagamento_id: p.id, skipped: "sem_telefone", user_id: userId });
        continue;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", userId)
        .maybeSingle();

      const phone = normalizePhone(tel.telefone);
      const cliente = p.acordos.cliente_nome || "cliente";
      const cpf = p.acordos.cliente_cpf || "";
      const venc = formatBR(p.data_prevista);
      const nomeOp = profile?.nome || "operador";
      const intro = tipo === "D-1"
        ? `⚠️ Lembrete: o acordo de *${cliente}*${cpf ? ` (CPF ${cpf})` : ""} tem parcela ${p.numero_parcela} vencendo *amanhã (${venc})*.`
        : `🚨 Lembrete urgente: o acordo de *${cliente}*${cpf ? ` (CPF ${cpf})` : ""} vence *hoje (${venc})* e ainda não foi marcado como boleto enviado.`;
      const mensagem = `Olá ${nomeOp}!\n\n${intro}\n\nLembre-se de enviar o boleto ao cliente e marcar como *"Boleto Enviado"* no sistema.`;

      if (dryRun) {
        results.push({ pagamento_id: p.id, phone, dryRun: true });
        continue;
      }

      try {
        const send = await supabase.functions.invoke("send-whatsapp", {
          body: {
            telefone: phone,
            mensagem,
            uazapi_server_url: config.instancia.server_url,
            uazapi_instance_token: config.instancia.instance_token,
            instancia_id: config.instancia.id,
          },
        });
        const ok = !send.error;
        await supabase.from("notificacoes_envios_log").insert({
          pagamento_id: p.id,
          user_id: userId,
          tipo,
          data_ref: dataRefLog,
          telefone: phone,
          sucesso: ok,
          erro: send.error ? String(send.error.message || send.error) : null,
        });
        results.push({ pagamento_id: p.id, ok, user_id: userId });
      } catch (e) {
        await supabase.from("notificacoes_envios_log").insert({
          pagamento_id: p.id,
          user_id: userId,
          tipo,
          data_ref: dataRefLog,
          telefone: phone,
          sucesso: false,
          erro: String((e as Error).message),
        });
        results.push({ pagamento_id: p.id, ok: false, erro: String((e as Error).message) });
      }

      // randomized delay 2-6s
      await sleep(rnd(2000, 6000));
    }

    return new Response(
      JSON.stringify({ ok: true, tipo, data_ref: dataRef, total: items.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
