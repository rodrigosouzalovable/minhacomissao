import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const diaBrt = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const domingoBrt = () => new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date()) === "Sun";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const service = createClient(url, serviceKey);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (token !== serviceKey) {
      const { data } = await service.auth.getUser(token); userId = data.user?.id ?? null;
      if (!userId) return json({ error: "Não autorizado" }, 401);
      const { data: admin } = await service.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (admin !== true) return json({ error: "Acesso permitido apenas para administradores" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const simulacao = body?.simulacao === true, modoTeste = body?.modo_teste === true;
    const telefoneTeste = String(body?.telefone_teste ?? "").replace(/\D/g, "");
    if (domingoBrt() && !modoTeste) return json({ success: true, skipped: true, motivo: "Envios automáticos são bloqueados aos domingos" });
    const { data: cfg, error: cfgError } = await service.from("certificado_config").select("*").limit(1).maybeSingle();
    if (cfgError) throw cfgError;
    if (!cfg?.meta_bm_id || !cfg?.template_nome) return json({ error: "Selecione a BM e o template" }, 409);
    if (!cfg.prospeccao_ativa && !simulacao && !modoTeste) return json({ error: "Piloto desativado" }, 409);
    const { data: instancias } = await service.from("meta_whatsapp_instances").select("id,nome,user_id,display_phone,saude_status,saude_quality,saude_ban_info,estado_pool,pool_fora_manual,pausa_automatica_ate,ativo")
      .eq("meta_bm_id", cfg.meta_bm_id).eq("provider", "meta").eq("ativo", true);
    const agora = new Date();
    const aptas = (instancias ?? []).filter((i: any) => i.estado_pool === "ativo" && i.pool_fora_manual !== true && String(i.saude_status ?? "").toUpperCase() === "CONNECTED" && !i.saude_ban_info && (!i.pausa_automatica_ate || new Date(i.pausa_automatica_ate) <= agora));
    if (!aptas.length) return json({ success: true, skipped: true, motivo: "Nenhuma instância Meta apta no pool" });
    const { data: templates } = await service.from("meta_whatsapp_templates").select("id,instancia_id,nome_template,idioma,status").in("instancia_id", aptas.map((i: any) => i.id)).eq("nome_template", cfg.template_nome).eq("idioma", cfg.template_idioma).eq("status", "approved");
    const porInstancia = new Map((templates ?? []).map((t: any) => [t.instancia_id, t]));
    const participantes = aptas.filter((i: any) => porInstancia.has(i.id));
    if (!participantes.length) return json({ success: true, skipped: true, motivo: "Template não aprovado em nenhuma instância apta" });
    if (modoTeste) {
      if (telefoneTeste.length < 10) return json({ error: "Informe um telefone de teste válido" }, 400);
      const instancia: any = participantes[0], template: any = porInstancia.get(instancia.id);
      const response = await fetch(`${url}/functions/v1/send-whatsapp-meta`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ template_id: template.id, instancia_id: instancia.id, cliente: { telefone: telefoneTeste, nome: "Cliente teste" }, user_id: userId ?? instancia.user_id, modo_teste: true }) });
      const result = await response.json().catch(() => ({}));
      return json({ success: result?.success === true, resultado: result, instancia: instancia.nome });
    }
    const { count } = await service.from("certificado_prospeccao_envios").select("id", { count: "exact", head: true }).eq("bm_id", cfg.meta_bm_id).gte("reservado_em", `${diaBrt()}T03:00:00.000Z`).in("status", ["reservado","enviado","entregue","lido","respondido"]);
    const restante = Math.max(0, Number(cfg.limite_diario ?? 50) - Number(count ?? 0));
    const { data: leads, error: leadsError } = await service.from("certificado_leads").select("id,cnpj,razao_social,nome_fantasia,telefone_principal").eq("whatsapp_status", "com_whatsapp").eq("situacao", "novo").not("telefone_principal", "is", null).order("created_at", { ascending: true }).limit(restante);
    if (leadsError) throw leadsError;
    if (simulacao) return json({ success: true, simulacao: true, elegiveis: leads?.length ?? 0, limite_restante: restante, participantes: participantes.map((i: any) => ({ id: i.id, nome: i.nome, telefone: i.display_phone })) });
    let enviados = 0, falhas = 0, rr = Number(cfg.ultimo_rr_indice ?? 0);
    for (const lead of leads ?? []) {
      const instancia: any = participantes[rr % participantes.length], template: any = porInstancia.get(instancia.id);
      const { data: reserva, error: reservaError } = await service.from("certificado_prospeccao_envios").insert({ lead_id: lead.id, bm_id: cfg.meta_bm_id, instancia_id: instancia.id, template_nome: cfg.template_nome, template_idioma: cfg.template_idioma }).select("id").maybeSingle();
      if (reservaError || !reserva) continue;
      const response = await fetch(`${url}/functions/v1/send-whatsapp-meta`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ template_id: template.id, instancia_id: instancia.id, cliente: { telefone: lead.telefone_principal, nome: lead.nome_fantasia || lead.razao_social || "cliente", cpf: lead.cnpj }, user_id: instancia.user_id }) });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result?.success === true) { enviados++; await service.from("certificado_prospeccao_envios").update({ status: "enviado", wa_message_id: result.wa_message_id ?? null, enviado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", reserva.id); await service.from("certificado_leads").update({ situacao: "enviado", updated_at: new Date().toISOString() }).eq("id", lead.id); }
      else { falhas++; await service.from("certificado_prospeccao_envios").update({ status: "falha", erro: String(result?.error ?? `HTTP ${response.status}`).slice(0,1000), updated_at: new Date().toISOString() }).eq("id", reserva.id); }
      rr++;
    }
    await service.from("certificado_config").update({ ultimo_rr_indice: rr, prospeccao_ultima_execucao: new Date().toISOString(), prospeccao_pausada_motivo: falhas && !enviados ? "Todos os envios falharam" : null }).eq("id", cfg.id);
    return json({ success: true, enviados, falhas, participantes: participantes.map((i: any) => i.nome) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Falha na prospecção" }, 500); }
});