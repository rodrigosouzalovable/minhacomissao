export type ManualTemplateResult = { instancia_id: string; status: string; motivo?: string };
type SubmitResponse = {
  success?: boolean; error?: string;
  instancias?: Array<{ id: string }>;
  adiadas?: Array<{ instancia_id: string; motivo: string }>;
  ignoradas?: Array<{ instancia_id: string; motivo: string }>;
};

export async function applyManualTemplate(
  masterId: string, instanceIds: string[],
  submit: (body: { mestre_id: string; instancia_ids: string[] }) => Promise<SubmitResponse>,
  defer: (ids: string[]) => Promise<void>,
  progress: (results: ManualTemplateResult[], done: number, total: number) => void,
): Promise<ManualTemplateResult[]> {
  const ids = [...new Set(instanceIds)];
  const results: ManualTemplateResult[] = [];
  for (let offset = 0; offset < ids.length; offset += 5) {
    const batch = ids.slice(offset, offset + 5);
    try {
      const response = await submit({ mestre_id: masterId, instancia_ids: batch });
      if (response.success !== true) throw new Error(response.error || 'Não foi possível iniciar a aplicação.');
      const started = new Set((response.instancias || []).map(r => r.id));
      const deferred = new Map((response.adiadas || []).map(r => [r.instancia_id, r.motivo]));
      const ignored = new Map((response.ignoradas || []).map(r => [r.instancia_id, r.motivo]));
      let deferError = '';
      if (deferred.size) {
        try { await defer([...deferred.keys()]); }
        catch (error) { deferError = error instanceof Error ? error.message : 'Não foi possível manter a aplicação na fila.'; }
      }
      for (const id of batch) {
        if (started.has(id)) results.push({ instancia_id: id, status: 'ENVIADO', motivo: 'Aplicação iniciada — aguardando a Meta' });
        else if (deferred.has(id)) results.push({ instancia_id: id, status: deferError ? 'FALHA_ENVIO' : 'PENDENTE', motivo: deferError || (deferred.get(id) === 'intervalo_2_5_min' ? 'Na fila — aguardando intervalo de 2–5 minutos' : 'Na fila — aguardando disponibilidade da cota diária') });
        else {
          const reason = ignored.get(id);
          const existing = ['submissao_existente_preservada', 'modelo_existente_na_meta'].includes(reason || '');
          const shared = reason === 'mesma_waba_ja_selecionada';
          results.push({ instancia_id: id, status: existing || shared ? 'EXISTENTE' : 'FALHA_ENVIO', motivo: shared ? 'Mesma conta WhatsApp — aplicação compartilhada com outro número do lote' : reason || 'A aplicação não confirmou o resultado deste número. Tente novamente.' });
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Falha ao aplicar o template.';
      results.push(...batch.map(id => ({ instancia_id: id, status: 'FALHA_ENVIO', motivo: reason })));
    }
    progress([...results], Math.min(offset + batch.length, ids.length), ids.length);
  }
  return results;
}