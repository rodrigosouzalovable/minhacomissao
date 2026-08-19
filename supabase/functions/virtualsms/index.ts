import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Provedores no protocolo padrão de ativação SMS (compatível SMS-Activate)
type Provider = "virtualsms" | "sms24h";

const PROVIDERS: Record<Provider, { base: string; secret: string; label: string; moeda: string }> = {
  virtualsms: {
    base: "https://api.virtualsms.de/stubs/handler_api",
    secret: "VIRTUALSMS_API_KEY",
    label: "VirtualSMS",
    moeda: "USD",
  },
  sms24h: {
    base: "https://api.sms24h.org/stubs/handler_api",
    secret: "SMS24H_API_KEY",
    label: "SMS24H",
    moeda: "BRL",
  },
};

const provOf = (v: unknown): Provider => (v === "sms24h" ? "sms24h" : "virtualsms");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Traduz códigos de erro do provedor para português claro
function humanizarErro(texto: string, label = "Provedor"): string {
  const t = (texto || "").trim().toUpperCase();
  const mapa: Record<string, string> = {
    BAD_KEY: `Chave da ${label} inválida. Confira a API Key no painel do provedor.`,
    BAD_ACTION: "Ação não suportada pelo provedor.",
    BANNED: `Conta bloqueada na ${label}.`,
    NO_BALANCE: `Saldo insuficiente na ${label}. Adicione fundos.`,
    NO_NUMBERS: "Nenhum número disponível para esse serviço/DDD/país agora. Tente outro DDD ou aguarde.",
    WRONG_SERVICE: "Serviço inválido. Escolha outro serviço da lista.",
    WRONG_COUNTRY: "País inválido.",
    NO_ACTIVATION: "Ativação não encontrada no provedor.",
    BAD_STATUS: "Status inválido para essa ativação.",
    EARLY_CANCEL_DENIED: "Só é possível cancelar após 5 minutos da compra (regra do provedor).",
    ERROR_SQL: `A ${label} está instável no momento. Tente novamente em instantes.`,
    NO_METRICS: "Sem dados suficientes no provedor.",
    WRONG_MAX_PRICE: "Preço máximo abaixo do mínimo aceito pelo provedor. Aumente o teto.",
  };
  if (mapa[t]) return mapa[t];
  return texto ? `${label}: ${texto}`.slice(0, 300) : `Resposta vazia da ${label}`;
}

const CODIGOS_ERRO = new Set([
  "BAD_KEY", "BAD_ACTION", "BANNED", "NO_BALANCE", "NO_NUMBERS", "WRONG_SERVICE",
  "WRONG_COUNTRY", "NO_ACTIVATION", "BAD_STATUS", "EARLY_CANCEL_DENIED", "ERROR_SQL",
  "NO_METRICS", "WRONG_ACTIVATION_ID", "RENEW_ACTIVATION_NOT_AVAILABLE", "WRONG_MAX_PRICE",
]);

// Chama o handler_api do provedor. Retorna { texto, dados } — dados só quando a resposta é JSON.
async function api(
  provider: Provider,
  action: string,
  params: Record<string, string | number | undefined> = {},
) {
  const cfg = PROVIDERS[provider];
  const apiKey = Deno.env.get(cfg.secret);
  if (!apiKey) throw new Error(`${cfg.secret} não configurada no backend.`);

  const url = new URL(cfg.base);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { headers: { Accept: "application/json, text/plain" } });
  const texto = (await res.text()).trim();

  let dados: any = null;
  try {
    dados = texto.startsWith("{") || texto.startsWith("[") ? JSON.parse(texto) : null;
  } catch { /* resposta em texto puro */ }

  const primeiro = texto.split(":")[0].toUpperCase();
  if (!res.ok && !dados) throw new Error(humanizarErro(texto || `HTTP ${res.status}`, cfg.label));
  if (CODIGOS_ERRO.has(primeiro)) throw new Error(humanizarErro(texto, cfg.label));

  return { texto, dados };
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const webhookUrl = () => {
  const ref = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "") || "";
  return `${ref}/functions/v1/virtualsms-webhook`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
    const provider = provOf(body?.provider);
    const cfgProv = PROVIDERS[provider];

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
    const cfg = async () => {
      const { data } = await admin
        .from("virtualsms_config")
        .select("id, limite_mensal_usd, preco_max_usd, ultimo_evento_em, ultima_rejeicao_em, ultima_rejeicao_motivo, ultima_rejeicao_debug")
        .limit(1)
        .maybeSingle();
      return data;
    };

    if (action === "saldo") {
      const conf = await cfg();
      // Resposta: ACCESS_BALANCE:10.50
      const { texto } = await api(provider, "getBalance");
      const saldo = num(texto.split(":")[1]);
      return json({
        ok: true,
        provider,
        provider_label: cfgProv.label,
        saldo,
        moeda: cfgProv.moeda,
        gasto_mes: await gastoMes(),
        limite_mensal_usd: Number(conf?.limite_mensal_usd ?? 20),
        preco_max_usd: Number(conf?.preco_max_usd ?? 0.9),
        webhook_url: webhookUrl(),
        webhook_ultimo_evento_em: conf?.ultimo_evento_em ?? null,
      });
    }

    if (action === "webhook_info") {
      const conf = await cfg();
      const seg = Deno.env.get("VIRTUALSMS_WEBHOOK_SECRET") ?? null;
      const base = webhookUrl();
      return json({
        ok: true,
        webhook_url: base,
        webhook_url_token: seg ? `${base}?token=${encodeURIComponent(seg)}` : base,
        secret: seg,
        ultimo_evento_em: conf?.ultimo_evento_em ?? null,
        ultima_rejeicao_em: (conf as any)?.ultima_rejeicao_em ?? null,
        ultima_rejeicao_motivo: (conf as any)?.ultima_rejeicao_motivo ?? null,
        ultima_rejeicao_debug: (conf as any)?.ultima_rejeicao_debug ?? null,
      });
    }


    if (action === "servicos") {
      const pais = body?.pais ? String(body.pais) : undefined;
      const { dados } = await api(provider, "getServicesList", { country: pais });
      const lista = Array.isArray(dados?.services) ? dados.services : [];
      if (lista.length) return json({ ok: true, servicos: lista });
      return json({
        ok: true,
        servicos: [
          { code: "wa", name: "WhatsApp" },
          { code: "tg", name: "Telegram" },
          { code: "go", name: "Google" },
          { code: "ig", name: "Instagram" },
          { code: "fb", name: "Facebook" },
        ],
      });
    }

    if (action === "paises") {
      const { dados } = await api(provider, "getCountries");
      const lista = dados && typeof dados === "object"
        ? Object.values(dados).map((c: any) => ({ id: String(c?.id ?? ""), nome: c?.eng ?? c?.rus ?? "" }))
          .filter((c) => c.id)
        : [];
      return json({ ok: true, paises: lista });
    }

    if (action === "precos") {
      const servico = String(body?.servico || "").trim();
      const pais = body?.pais ? String(body.pais) : undefined;
      if (!servico) return json({ error: "Informe o serviço." }, 400);
      const { dados } = await api(provider, "getPrices", { service: servico, country: pais });

      // Extrai o menor custo disponível do formato { pais: { servico: { custo: qtd } } }
      let menor: number | null = null;
      const varrer = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        for (const [k, v] of Object.entries(obj)) {
          if (v && typeof v === "object") varrer(v);
          else {
            const preco = Number(k);
            const qtd = Number(v);
            if (Number.isFinite(preco) && preco > 0 && (!Number.isFinite(qtd) || qtd > 0)) {
              if (menor === null || preco < menor) menor = preco;
            }
          }
        }
      };
      varrer(dados);

      return json({ ok: true, precos: dados ?? {}, menor_preco: menor, moeda: cfgProv.moeda });
    }

    if (action === "comprar") {
      const servico = String(body?.servico || "").trim();
      const pais = body?.pais !== undefined && body?.pais !== null && String(body.pais) !== ""
        ? String(body.pais)
        : "73"; // Brasil por padrão
      const ddd = body?.ddd ? String(body.ddd).replace(/\D/g, "") : "";
      if (!servico) return json({ error: "Informe o serviço (ex.: wa)." }, 400);

      const gasto = await gastoMes();
      const conf = await cfg();
      const lim = Number(conf?.limite_mensal_usd ?? 20);
      if (lim > 0 && gasto >= lim) {
        return json({ error: `Limite mensal de US$ ${lim.toFixed(2)} atingido (gasto: US$ ${gasto.toFixed(2)}). Aumente o limite para continuar.` }, 400);
      }

      // Teto de preço por compra (evita a variação de preço dinâmico do provedor)
      const tetoBruto = body?.max_preco !== undefined && body?.max_preco !== null && String(body.max_preco) !== ""
        ? Number(body.max_preco)
        : Number(conf?.preco_max_usd ?? 0.9);
      const teto = Number.isFinite(tetoBruto) && tetoBruto > 0 ? tetoBruto : null;

      let orderId = "";
      let numero: string | null = null;
      let custo: number | null = null;

      if (provider === "sms24h" && ddd) {
        // SMS24H aceita a escolha do DDD na compra
        const { dados, texto } = await api(provider, "getNumber", {
          service: servico,
          country: pais,
          ddd,
          maxPrice: teto ?? undefined,
        });
        if (dados?.activationId || dados?.id) {
          orderId = String(dados.activationId ?? dados.id);
          numero = dados.phoneNumber ? String(dados.phoneNumber) : (dados.number ? String(dados.number) : null);
          custo = num(dados.activationCost ?? dados.cost);
        } else {
          // Formato texto: ACCESS_NUMBER:id:numero
          const partes = texto.split(":");
          if (partes[0]?.toUpperCase() === "ACCESS_NUMBER") {
            orderId = partes[1] ?? "";
            numero = partes[2] ?? null;
          }
        }
      } else {
        const { dados } = await api(provider, "getNumberV2", {
          service: servico,
          country: pais,
          maxPrice: teto ?? undefined,
          operator: body?.operadora ? String(body.operadora) : undefined,
        });
        orderId = String(dados?.activationId ?? "");
        numero = dados?.phoneNumber ? String(dados.phoneNumber) : null;
        custo = num(dados?.activationCost);
      }

      if (!orderId) return json({ error: "O provedor não retornou o identificador da ativação." }, 502);

      // Trava de segurança: se o provedor cobrou acima do teto, cancela e avisa
      if (teto !== null && custo !== null && custo > teto + 0.0001) {
        await api(provider, "setStatus", { id: orderId, status: 8 }).catch(() => {});
        return json({
          error: `O provedor ofereceu o número por ${cfgProv.moeda === "BRL" ? "R$" : "US$"} ${custo.toFixed(2)}, acima do teto de ${cfgProv.moeda === "BRL" ? "R$" : "US$"} ${teto.toFixed(2)}. Compra cancelada — ajuste o teto ou tente novamente mais tarde.`,
        }, 400);
      }

      const dddDetectado = ddd || (numero && numero.startsWith("55") ? numero.slice(2, 4) : null);

      const { data: pedido, error: insErr } = await admin
        .from("virtualsms_pedidos")
        .insert({
          order_id: orderId,
          provider,
          servico,
          pais,
          ddd: dddDetectado,
          numero,
          custo,
          status: "aguardando",
          expira_em: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          criado_por: user.id,
        })
        .select()
        .single();
      if (insErr) return json({ error: `Número comprado, mas falhou ao gravar: ${insErr.message}`, order_id: orderId }, 500);

      return json({ ok: true, pedido });
    }

    if (action === "status") {
      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ error: "order_id obrigatório" }, 400);

      const { dados, texto } = await api(provider, "getStatusV2", { id: orderId });
      const statusProv = String(dados?.status ?? texto.split(":")[0] ?? "").toUpperCase();
      const codigo = dados?.code ?? (texto.startsWith("STATUS_OK") ? texto.split(":")[1] : null);

      let novoStatus = "aguardando";
      if (codigo) novoStatus = "recebido";
      else if (statusProv.includes("CANCEL")) novoStatus = "cancelado";

      const patch: Record<string, unknown> = { status: novoStatus, updated_at: new Date().toISOString() };
      if (codigo) {
        patch.codigo = String(codigo);
        patch.recebido_em = new Date().toISOString();
      }
      if (novoStatus === "cancelado") patch.custo = 0;
      await admin.from("virtualsms_pedidos").update(patch).eq("order_id", orderId);

      // Finaliza a ativação no provedor quando o código chegou (libera o número)
      if (codigo) await api(provider, "setStatus", { id: orderId, status: 6 }).catch(() => {});

      return json({ ok: true, status: novoStatus, codigo: codigo ? String(codigo) : null });
    }

    if (action === "cancelar") {
      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ error: "order_id obrigatório" }, 400);
      await api(provider, "setStatus", { id: orderId, status: 8 });
      await admin
        .from("virtualsms_pedidos")
        .update({ status: "cancelado", custo: 0, updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      return json({ ok: true });
    }

    if (action === "marcar_banido") {
      const orderId = String(body?.order_id || "").trim();
      if (!orderId) return json({ error: "order_id obrigatório" }, 400);
      const banido = body?.banido === false ? null : new Date().toISOString();
      await admin
        .from("virtualsms_pedidos")
        .update({ banido_em: banido, updated_at: new Date().toISOString() })
        .eq("order_id", orderId);
      return json({ ok: true, banido_em: banido });
    }

    if (action === "salvar_limite") {
      const conf = await cfg();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (body?.limite_mensal_usd !== undefined) {
        const valor = Number(body.limite_mensal_usd);
        if (!Number.isFinite(valor) || valor < 0) return json({ error: "Limite inválido" }, 400);
        patch.limite_mensal_usd = valor;
      }
      if (body?.preco_max_usd !== undefined) {
        const teto = Number(body.preco_max_usd);
        if (!Number.isFinite(teto) || teto < 0) return json({ error: "Preço máximo inválido" }, 400);
        patch.preco_max_usd = teto;
      }
      if (Object.keys(patch).length === 1) return json({ error: "Nada para salvar" }, 400);

      if (conf?.id) {
        await admin.from("virtualsms_config").update(patch).eq("id", conf.id);
      } else {
        delete patch.updated_at;
        await admin.from("virtualsms_config").insert(patch);
      }
      return json({ ok: true, ...patch });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[virtualsms]", msg);
    return json({ error: msg }, 400);
  }
});
