// Registra o ponto do funcionário validando IP autorizado, ordem das marcações e horário do servidor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";
import { dataBRT, horaBRT, ipDoRequest, ipAutorizado, proximoTipo, LABEL_PONTO, ORDEM_PONTO, type PontoTipo } from "../_shared/ponto.ts";

const NOTIFICAR = ["62991672674"];


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sessão inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.tipo ?? "") as PontoTipo;
    if (!ORDEM_PONTO.includes(tipo)) return json({ error: "Tipo de marcação inválido" }, 400);
    const deviceId = typeof body?.device_id === "string" ? body.device_id.slice(0, 100) : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = ipDoRequest(req);

    // Admin não precisa de restrição de IP
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    if (!isAdmin) {
      const { data: regras } = await admin
        .from("ponto_ips_autorizados")
        .select("cidr, ativo")
        .eq("ativo", true);
      const lista = regras ?? [];
      if (lista.length === 0) {
        return json({
          error: "Nenhuma rede autorizada foi cadastrada ainda. Fale com o administrador.",
          codigo: "sem_ip_cadastrado",
        }, 403);
      }
      if (!ipAutorizado(ip, lista)) {
        return json({
          error: "Você só pode bater ponto na rede do escritório.",
          codigo: "ip_nao_autorizado",
          ip,
        }, 403);
      }
    }

    const data = dataBRT();
    const { data: doDia } = await admin
      .from("ponto_registros")
      .select("tipo")
      .eq("user_id", userId)
      .eq("data", data);
    const registrados = (doDia ?? []).map((r: { tipo: string }) => r.tipo);

    if (registrados.includes(tipo)) {
      return json({ error: `${LABEL_PONTO[tipo]} já foi registrada hoje.`, codigo: "duplicado" }, 409);
    }
    const esperado = proximoTipo(registrados);
    if (esperado !== tipo) {
      return json({
        error: esperado
          ? `A próxima marcação do dia é "${LABEL_PONTO[esperado]}".`
          : "Todas as marcações do dia já foram registradas.",
        codigo: "fora_de_ordem",
        esperado,
      }, 409);
    }

    const { data: inserido, error: insErr } = await admin
      .from("ponto_registros")
      .insert({
        user_id: userId,
        data,
        tipo,
        ip: ip || null,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 300) || null,
        device_id: deviceId,
        origem: "auto",
      })
      .select("id, tipo, registrado_em")
      .single();

    if (insErr) return json({ error: insErr.message }, 400);

    // Presença: registrar como ativo (ou almoço quando sai para o almoço)
    await admin.from("atividade_presenca").upsert({
      user_id: userId,
      ultima_interacao: new Date().toISOString(),
      status: tipo === "saida_almoco" ? "almoco" : tipo === "saida" ? "offline" : "ativo",
      inativo_desde: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Notificação no WhatsApp do administrador (nunca bloqueia a batida)
    try {
      const { data: perfil } = await admin
        .from("profiles")
        .select("nome")
        .eq("id", userId)
        .maybeSingle();
      const quando = new Date(inserido!.registrado_em);
      const dataFmt = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(quando);
      const horaFmt = horaBRT(quando);
      const linhas = [
        "*PONTO REGISTRADO*",
        (perfil as { nome?: string } | null)?.nome || "Funcionário",
        LABEL_PONTO[tipo],
        `${dataFmt} às ${horaFmt} (BRT)`,
      ];
      if (ip) linhas.push(`Rede: ${ip}`);
      await notificarNumeros(admin, {
        tipo: "ponto_batida",
        mensagem: linhas.join("\n"),
        destinatarios: NOTIFICAR,
        chaveIdempotencia: `ponto:${userId}:${data}:${tipo}`,
      });
    } catch (e) {
      console.error("[ponto-registrar] falha ao notificar", e);
    }

    return json({ ok: true, registro: inserido, proximo: proximoTipo([...registrados, tipo]) });

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
