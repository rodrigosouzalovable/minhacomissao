type Resultado = { verificados: number; com_whatsapp: number; sem_whatsapp: number; erros: number; instancias_validadoras: string[] };

const normalizar = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
};

async function conectada(instancia: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${String(instancia.server_url).replace(/\/+$/, "")}/instance/status`, {
      headers: { token: String(instancia.instance_token) }, signal: controller.signal,
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    const state = String(data?.instance?.status ?? data?.status?.status ?? data?.status ?? "").toLowerCase();
    return data?.status?.connected === true || data?.connected === true || state === "connected" || state === "open";
  } catch { return false; } finally { clearTimeout(timeout); }
}

export async function verificarLeadsCertificado(service: any, limite = 1000): Promise<Resultado> {
  const { data: selecionadas, error } = await service.from("certificado_uazapi_verificadoras")
    .select("instancia_id, instancia:user_whatsapp_instances(id,nome,server_url,instance_token,ativo)").eq("ativa", true);
  if (error) throw error;
  const candidatas = (selecionadas ?? []).map((row: any) => row.instancia).filter((i: any) => i?.ativo && i?.server_url && i?.instance_token);
  const estados = await Promise.all(candidatas.map(async (instancia: any) => ({ instancia, ativa: await conectada(instancia) })));
  const instancias = estados.filter((item) => item.ativa).map((item) => item.instancia);
  if (!instancias.length) return { verificados: 0, com_whatsapp: 0, sem_whatsapp: 0, erros: 0, instancias_validadoras: [] };

  const { data: leads, error: leadsError } = await service.from("certificado_leads").select("id,telefone_principal")
    .in("whatsapp_status", ["pendente", "nao_verificado", "erro_temporario"]).not("telefone_principal", "is", null)
    .order("created_at", { ascending: true }).limit(Math.min(Math.max(limite, 1), 2000));
  if (leadsError) throw leadsError;
  const lotes: any[][] = [];
  for (let i = 0; i < (leads ?? []).length; i += 15) lotes.push((leads ?? []).slice(i, i + 15));
  let comWhatsapp = 0, semWhatsapp = 0, erros = 0;
  const resultados = await Promise.all(lotes.map(async (lote, indiceLote) => {
    for (let tentativa = 0; tentativa < Math.min(instancias.length, 2); tentativa++) {
      const instancia = instancias[(indiceLote + tentativa) % instancias.length];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const response = await fetch(`${String(instancia.server_url).replace(/\/+$/, "")}/chat/check`, {
          method: "POST", headers: { "Content-Type": "application/json", token: String(instancia.instance_token) },
          body: JSON.stringify({ numbers: lote.map((lead) => normalizar(lead.telefone_principal)) }), signal: controller.signal,
        });
        if (!response.ok) continue;
        const payload = await response.json().catch(() => null);
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.numbers) ? payload.numbers : Array.isArray(payload?.result) ? payload.result : null;
        if (!rows || rows.length !== lote.length) continue;
        const idsCom: string[] = [], idsSem: string[] = [];
        rows.forEach((item: any, index: number) => {
          const lead = lote[index]; if (!lead) return;
          const existe = item.isInWhatsapp === true || item.exists === true || item.numberExists === true || item.onWhatsapp === true;
          (existe ? idsCom : idsSem).push(lead.id);
        });
        const checkedAt = new Date().toISOString();
        if (idsCom.length) await service.from("certificado_leads").update({ whatsapp_status: "com_whatsapp", whatsapp_verificado_em: checkedAt, whatsapp_instancia_id: instancia.id }).in("id", idsCom);
        if (idsSem.length) await service.from("certificado_leads").update({ whatsapp_status: "sem_whatsapp", whatsapp_verificado_em: checkedAt, whatsapp_instancia_id: instancia.id }).in("id", idsSem);
        return { idsCom, idsSem, instanciaId: instancia.id, erro: false };
      } catch { /* tenta outra instância */ } finally { clearTimeout(timeout); }
    }
    return { idsCom: [], idsSem: [], idsErro: lote.map((lead) => lead.id), instanciaId: null, erro: true };
  }));

  for (const resultado of resultados) {
    if (resultado.erro) {
      const ids = resultado.idsErro ?? [];
      if (ids.length) await service.from("certificado_leads").update({ whatsapp_status: "erro_temporario" }).in("id", ids);
      erros += ids.length;
      continue;
    }
    const checkedAt = new Date().toISOString();
    if (resultado.idsCom.length) await service.from("certificado_leads").update({ whatsapp_status: "com_whatsapp", whatsapp_verificado_em: checkedAt, whatsapp_instancia_id: resultado.instanciaId }).in("id", resultado.idsCom);
    if (resultado.idsSem.length) await service.from("certificado_leads").update({ whatsapp_status: "sem_whatsapp", whatsapp_verificado_em: checkedAt, whatsapp_instancia_id: resultado.instanciaId }).in("id", resultado.idsSem);
    comWhatsapp += resultado.idsCom.length;
    semWhatsapp += resultado.idsSem.length;
  }
  return { verificados: comWhatsapp + semWhatsapp, com_whatsapp: comWhatsapp, sem_whatsapp: semWhatsapp, erros, instancias_validadoras: instancias.map((i) => i.nome).filter(Boolean) };
}