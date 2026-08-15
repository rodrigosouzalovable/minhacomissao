import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const buscaId = String(body?.busca_id ?? "");
    const revalidar = body?.revalidar === true;
    if (!buscaId) return json({ error: "busca_id é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Leads da busca com telefone e ainda não verificados (ou todos, se revalidar)
    let q = admin
      .from("google_maps_leads")
      .select("id, telefone, telefone_internacional, tem_whatsapp")
      .eq("busca_id", buscaId)
      .not("telefone", "is", null);
    if (!revalidar) q = q.is("tem_whatsapp", null);
    const { data: leads, error: leadsErr } = await q;
    if (leadsErr) return json({ error: leadsErr.message }, 500);

    if (!leads?.length) {
      return json({ verificados: 0, com_whatsapp: 0, sem_whatsapp: 0, erros: 0, message: "Nada a verificar" });
    }

    // Instância UAZAPI conectada para validar
    const { data: instancias, error: instErr } = await admin
      .from("user_whatsapp_instances")
      .select("id, nome, server_url, instance_token, ativo, tipo, ordem")
      .eq("ativo", true)
      .not("server_url", "is", null)
      .not("instance_token", "is", null)
      .order("ordem", { ascending: true, nullsFirst: false });

    if (instErr) console.error("erro ao listar instâncias:", instErr.message);

    const candidatas = instancias ?? [];
    let validador: Record<string, unknown> | null = null;
    const motivos: string[] = [];

    for (const inst of candidatas) {
      const url = String(inst.server_url).replace(/\/+$/, "");
      const tk = String(inst.instance_token);
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 12000);
        const r = await fetch(`${url}/instance/status`, {
          headers: { token: tk },
          signal: ctl.signal,
        });
        clearTimeout(to);
        const txt = await r.text();
        console.log(`status ${inst.nome}: HTTP ${r.status} ${txt.slice(0, 200)}`);
        let conectado = false;
        try {
          const d = JSON.parse(txt) as Record<string, any>;
          const st = String(d?.instance?.status ?? d?.status ?? "").toLowerCase();
          conectado =
            d?.status?.connected === true ||
            d?.connected === true ||
            st.includes("connect") ||
            st === "open";
        } catch {
          conectado = false;
        }
        if (conectado) {
          validador = inst;
          break;
        }
        motivos.push(`${inst.nome}: desconectada`);
      } catch (e) {
        motivos.push(`${inst.nome}: ${e instanceof Error ? e.message : "falha"}`);
      }
    }

    if (!validador) {
      return json(
        {
          error: "sem_instancia",
          message: candidatas.length
            ? `Nenhuma instância WhatsApp (UAZAPI) respondeu como conectada. Detalhes: ${motivos.join(" | ")}`
            : "Nenhuma instância WhatsApp (UAZAPI) ativa cadastrada. Conecte uma instância e tente novamente.",
        },
        200,
      );
    }

    console.log(`instância validadora: ${validador.nome}`);
    const cleanUrl = String(validador.server_url).replace(/\/+$/, "");
    const token = String(validador.instance_token);


    const comWhats: string[] = [];
    const semWhats: string[] = [];
    let erros = 0;

    const BATCH = 15;
    const CONCURRENCY = 3;
    const TIMEOUT = 45000;

    type Item = { id: string; numero: string };
    const items: Item[] = leads
      .map((l: Record<string, unknown>) => ({
        id: String(l.id),
        numero: formatPhone(String(l.telefone_internacional ?? l.telefone ?? "")),
      }))
      .filter((i: Item) => i.numero.replace(/\D/g, "").length >= 12);

    const batches: Item[][] = [];
    for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));

    const runBatch = async (batch: Item[]) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), TIMEOUT);
      try {
        const resp = await fetch(`${cleanUrl}/chat/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token },
          body: JSON.stringify({ numbers: batch.map((b) => b.numero) }),
          signal: controller.signal,
        });
        const text = await resp.text();
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          console.error(`resposta não-JSON: ${text.slice(0, 200)}`);
          erros += batch.length;
          return;
        }
        if (!resp.ok) {
          console.error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
          erros += batch.length;
          return;
        }
        const d = data as Record<string, unknown>;
        const arr = Array.isArray(data)
          ? (data as Record<string, unknown>[])
          : Array.isArray(d?.numbers)
          ? (d.numbers as Record<string, unknown>[])
          : Array.isArray(d?.result)
          ? (d.result as Record<string, unknown>[])
          : null;
        if (!arr) {
          console.error(`formato desconhecido: ${text.slice(0, 300)}`);
          erros += batch.length;
          return;
        }
        arr.forEach((item, idx) => {
          const lead = batch[idx];
          if (!lead) return;
          const has =
            item.isInWhatsapp === true ||
            item.exists === true ||
            item.numberExists === true ||
            item.onWhatsapp === true;
          (has ? comWhats : semWhats).push(lead.id);
        });
      } catch (e) {
        console.error(`erro no lote: ${e instanceof Error ? e.message : String(e)}`);
        erros += batch.length;
      } finally {
        clearTimeout(t);
      }
    };

    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      await Promise.all(batches.slice(i, i + CONCURRENCY).map(runBatch));
    }

    const agora = new Date().toISOString();
    if (comWhats.length) {
      await admin
        .from("google_maps_leads")
        .update({ tem_whatsapp: true, whatsapp_verificado_em: agora })
        .in("id", comWhats);
    }
    if (semWhats.length) {
      await admin
        .from("google_maps_leads")
        .update({ tem_whatsapp: false, whatsapp_verificado_em: agora })
        .in("id", semWhats);
    }

    return json({
      verificados: comWhats.length + semWhats.length,
      com_whatsapp: comWhats.length,
      sem_whatsapp: semWhats.length,
      erros,
      instancia: validador.nome ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erro";
    console.error("google-maps-verificar-whatsapp:", message);
    return json({ error: message }, 500);
  }
});
