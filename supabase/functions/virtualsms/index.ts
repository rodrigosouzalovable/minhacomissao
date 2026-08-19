import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE = "https://virtualsms.io/api/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Traduz erros do provedor para português claro
function humanizarErro(status: number, texto: string): string {
  const t = (texto || "").toLowerCase();
  if (status === 401 || status === 403 || t.includes("unauthorized") || t.includes("invalid api key")) {
    return "Chave da VirtualSMS inválida ou sem permissão. Verifique a API Key cadastrada.";
  }
  if (t.includes("insufficient") || t.includes("balance")) {
    return "Saldo insuficiente na VirtualSMS. Faça um depósito na conta do provedor.";
  }
  if (t.includes("no numbers") || t.includes("out of stock") || t.includes("not available") || status === 404) {
    return "Nenhum número disponível para esse serviço/país neste momento. Tente outro país ou aguarde alguns minutos.";
  }
  if (status === 429) return "Muitas requisições ao provedor. Aguarde alguns segundos e tente de novo.";
  if (status >= 500) return "A VirtualSMS está instável no momento. Tente novamente em instantes.";
  return texto ? `VirtualSMS: ${texto}`.slice(0, 300) : `VirtualSMS retornou HTTP ${status}`;
}

async function vsms(path: string, init?: RequestInit) {
  const apiKey = Deno.env.get("VIRTUALSMS_API_KEY");
  if (!apiKey) throw new Error("VIRTUALSMS_API_KEY não configurada no backend.");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || data?.detail || raw;
    throw new Error(humanizarErro(res.status, typeof msg === "string" ? msg : JSON.stringify(msg)));
  }
  return data;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Extrai campos com nomes variados que o provedor pode usar
const pick = (obj: any, keys: string[]) => {
  for (const k of keys) {
    const v = k.split(".").reduce<any>((acc, part) => (acc == null ? acc : acc[part]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // --- Autenticação + checagem de admin ---
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: "Sessão inválida" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores podem usar números virtuais." }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action || "saldo");

    // --- Gasto do mês e limite ---
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    inicioMes.setUTCHours(0, 0, 0, 0);

    const gastoMes = async () => {
      const { data } = await admin
        .from("virtualsms_pedidos")
        .select("custo")
        .gte("created_at", inicioMes.toISOString())
        .neq("status", "reembolsado");
      return (data || []).reduce((s: number, r: any) => s + (Number(r.custo) || 0), 0);
    };
    const limite = async () => {
      const { data } = await admin.from("virtualsms_config").select("limite_mensal_usd").limit(1).maybeSingle();
      return Number(data?.limite_mensal_usd ?? 20);
    };

    if (action === "saldo") {
      const data = await vsms("/balance");
      const saldo = num(pick(data, ["balance", "data.balance", "amount", "data.amount"]));
      return json({
        ok: true,
        saldo,
        moeda: pick(data, ["currency", "data.currency"]) || "USD",
        gasto_mes: await gastoMes(),
        limite_mensal_usd: await limite(),
      });
    }

    if (action === "servicos") {
      try {
        const data = await vsms("/services");
        const lista = Array.isArray(data) ? data : (data?.data ?? data?.services ?? []);
        if (Array.isArray(lista) && lista.length) return json({ ok: true, servicos: lista });
      } catch (_) {
        // provedor pode não expor esse endpoint — usamos a lista padrão abaixo
      }
      return json({
        ok: true,
        servicos: [
          { code: "whatsapp", name: "WhatsApp" },
          { code: "telegram", name: "Telegram" },
          { code: "google", name: "Google" },
          { code: "instagram", name: "Instagram" },
          { code: "facebook", name: "Facebook" },
        ],
      });
    }

    if (action === "comprar") {
      const servico = String(body?.servico || "").trim();
      const pais = body?.pais ? String(body.pais).trim() : null;
      if (!servico) return json({ error: "Informe o serviço (ex.: whatsapp)." }, 400);

      const gasto = await gastoMes();
      const lim = await limite();
      if (lim > 0 && gasto >= lim) {
        return json({ error: `Limite mensal de US$ ${lim.toFixed(2)} atingido (gasto: US$ ${gasto.toFixed(2)}). Aumente o limite para continuar.` }, 400);
      }

      const data = await vsms("/orders", {
        method: "POST",
        body: JSON.stringify({ service: servico, ...(pais ? { country: pais } : {}) }),
      });

      const orderId = String(pick(data, ["id", "order_id", "data.id", "data.order_id"]) ?? "");
      const numero = pick(data, ["phone", "number", "phone_number", "data.phone", "data.number", "data.phone_number"]);
      const custo = num(pick(data, ["price", "cost", "data.price", "data.cost"]));
      const expira = pick(data, ["expires_at", "expire_at", "data.expires_at", "data.expire_at"]);

      if (!orderId) return json({ error: "O provedor não retornou o identificador do pedido." }, 502);

      const { data: pedido, error: insErr } = await admin
        .from("virtualsms_pedidos")
        .insert({
          order_id: orderId,
          servico,
          pais,
          numero: numero ? String(numero) : null,
          custo,
          status: "aguardando",
          expira_em: expira ? new Date(expira).toISOString() : new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          criado_por: user.id,
        })
        .select()
        .single();
      if (insErr) return json({ error: `Pedido criado no provedor, mas falhou ao gravar: ${insErr.message}`, order_id: orderId }, 500);

      return json({ ok: true, pedido });
    }

    if (action === "status") {
      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ error: "order_id obrigatório" }, 400);

      const data = await vsms(`/orders/${encodeURIComponent(orderId)}/sms`);
      const lista = Array.isArray(data) ? data : (data?.data ?? data?.sms ?? data?.messages ?? []);
      const primeiro = Array.isArray(lista) ? lista[0] : lista;
      const codigo = pick(primeiro ?? {}, ["code", "sms_code", "otp"]) ||
        pick(data, ["code", "data.code", "sms_code"]);
      const texto = pick(primeiro ?? {}, ["text", "message", "content"]);
      const statusProv = String(pick(data, ["status", "data.status"]) || "").toLowerCase();

      let novoStatus = "aguardando";
      if (codigo) novoStatus = "recebido";
      else if (statusProv.includes("cancel")) novoStatus = "cancelado";
      else if (statusProv.includes("refund")) novoStatus = "reembolsado";
      else if (statusProv.includes("expir") || statusProv.includes("timeout")) novoStatus = "expirado";

      const patch: Record<string, unknown> = { status: novoStatus, updated_at: new Date().toISOString() };
      if (codigo) patch.codigo = String(codigo);
      if (novoStatus === "reembolsado" || novoStatus === "expirado") patch.custo = 0;
      await admin.from("virtualsms_pedidos").update(patch).eq("order_id", orderId);

      return json({ ok: true, status: novoStatus, codigo: codigo ? String(codigo) : null, texto: texto ? String(texto) : null });
    }

    if (action === "cancelar") {
      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ error: "order_id obrigatório" }, 400);
      try {
        await vsms(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });
      } catch (e) {
        // Alguns provedores usam DELETE
        await vsms(`/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" }).catch(() => {
          throw e;
        });
      }
      await admin
        .from("virtualsms_pedidos")
        .update({ status: "cancelado", custo: 0, updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      return json({ ok: true });
    }

    if (action === "salvar_limite") {
      const valor = Number(body?.limite_mensal_usd);
      if (!Number.isFinite(valor) || valor < 0) return json({ error: "Limite inválido" }, 400);
      const { data: cfg } = await admin.from("virtualsms_config").select("id").limit(1).maybeSingle();
      if (cfg?.id) {
        await admin
          .from("virtualsms_config")
          .update({ limite_mensal_usd: valor, updated_at: new Date().toISOString() })
          .eq("id", cfg.id);
      } else {
        await admin.from("virtualsms_config").insert({ limite_mensal_usd: valor });
      }
      return json({ ok: true, limite_mensal_usd: valor });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[virtualsms]", msg);
    return json({ error: msg }, 400);
  }
});
