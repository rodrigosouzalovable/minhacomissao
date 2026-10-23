import { sincronizarTemplatesMeta } from "./sincronizar-templates-meta.ts";

/** Decide se a pausa por reprovações pode ser removida: só com leitura completa e zero rejeitados. */
export function decidirLiberacaoReprovacoes(syncOk: boolean, rejeitados: string[]): { liberar: boolean; motivo?: string } {
  if (!syncOk) return { liberar: false, motivo: "fila pausada por reprovações — não foi possível conferir os templates na Meta agora; tente novamente" };
  if (rejeitados.length) return { liberar: false, motivo: `fila pausada: ainda há ${rejeitados.length} template(s) rejeitado(s) neste número (${rejeitados.slice(0, 5).join(", ")}). Exclua-os na BM e tente de novo` };
  return { liberar: true };
}

/** Sincroniza com a Meta e libera a pausa por reprovações quando não restam rejeitados. Retorna motivo se continuar pausado. */
export async function liberarPausaReprovacoes(supabase: any, inst: any): Promise<string | null> {
  const sync = await sincronizarTemplatesMeta(supabase, inst, AbortSignal.timeout(25_000));
  let rejeitados: string[] = [];
  if (sync.success) {
    // Remove do espelho local os templates que não existem mais na Meta (excluídos na BM).
    await supabase.from("meta_whatsapp_templates").delete()
      .eq("instancia_id", inst.id).lt("sincronizado_em", new Date(Date.now() - 60_000).toISOString());
    const { data } = await supabase.from("meta_whatsapp_templates")
      .select("nome_template,status").eq("instancia_id", inst.id).eq("status", "rejected");
    rejeitados = (data || []).map((r: any) => r.nome_template);
  }
  const d = decidirLiberacaoReprovacoes(sync.success, rejeitados);
  if (!d.liberar) return d.motivo!;
  await supabase.from("meta_whatsapp_instances").update({
    templates_auto_status: null, templates_auto_rejeicoes_seguidas: 0, templates_auto_pausado_ate: null,
  }).eq("id", inst.id);
  inst.templates_auto_status = null;
  inst.templates_auto_pausado_ate = null;
  return null;
}
