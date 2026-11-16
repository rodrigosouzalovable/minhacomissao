// Pedido de boleto/PIX (botão "QUERO O BOLETO" ou texto explícito) em conversas UME/Odres Cred.
// Responde na hora, mesmo com atendente humano vinculado (o atendente continua na conversa).

export const ehPedidoBoletoImediato = (t: string) =>
  /(boleto|\bpix\b|c[oó]digo de barras|linha digit[aá]vel|segunda via|2ª via)/i.test(String(t || ''));

export const credorBoletoAutomatico = (credor: string) =>
  /\bUME\b|odres|novo\s*mundo/i.test(String(credor || ''));

/** Sábado/domingo => próxima segunda; dia útil => o próprio dia (data ISO em BRT). */
export function vencimentoDiaUtil(hojeIso: string): string {
  const d = new Date(`${hojeIso}T12:00:00Z`);
  const dow = d.getUTCDay();
  const add = dow === 6 ? 2 : dow === 0 ? 1 : 0;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

/** Apenas o clique no botão "QUERO O BOLETO" (texto exato do botão) dispara envio automático. */
export const ehBotaoQueroBoleto = (t: string) =>
  /^\s*quero\s+o\s+boleto\s*[!.]?\s*$/i.test(String(t || ''));

/** Cobrança só é enviada se não passar da parcela do acordo (+50% de tolerância p/ juros/multa). */
export const valorCompativelComParcela = (cobranca: number | null, parcela: number | null) =>
  !!cobranca && !!parcela && parcela > 0 && cobranca <= parcela * 1.5;

/** Parcela pendente do acordo ativo: a vencida mais antiga ou, sem atraso, a próxima a vencer. */
// deno-lint-ignore no-explicit-any
export async function valorParcelaAcordo(supabase: any, cpf: string): Promise<number | null> {
  const { data: ac } = await supabase.from('acordos').select('id')
    .eq('cliente_cpf', cpf).order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (!ac?.id) return null;
  const { data: p } = await supabase.from('pagamentos').select('valor_parcela')
    .eq('acordo_id', ac.id).eq('status', 'pendente')
    .order('data_prevista', { ascending: true }).limit(1).maybeSingle();
  const v = Number(p?.valor_parcela ?? 0);
  return v > 0 ? v : null;
}
