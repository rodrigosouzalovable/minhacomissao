import { classificarPagamento, podeLimparTravaPagamento, type PagamentoEstado } from './meta-pagamento-status.ts';
import { rotuloInstancia } from './rotulo-instancia.ts';

// Replaces the existing blocking confirmation GET, not a new recurring check.
export async function revalidarPagamentoAntesDoAviso(supabase: any, inst: any) {
  const { data: atual, error: readError } = await supabase.from('meta_whatsapp_instances')
    .select('id, ativo, estado_pool, pausa_automatica_ate, pausa_automatica_motivo, pool_fora_manual, quarentena_ate, recuperacao_ativa, saude_raw')
    .eq('id', inst.id).maybeSingle();
  if (readError || !atual) throw new Error('Não foi possível consultar a proteção atual da instância');
  const cached = atual.saude_raw?.pagamento_verificacao;
  let estado: PagamentoEstado = 'nao_confirmado';
  let phone: any = null;
  let verificadoEm = new Date().toISOString();
  let detalhe = 'A Meta não retornou informação suficiente para confirmar o pagamento.';
  if (cached && Date.now() - new Date(cached.em).getTime() >= 0 && Date.now() - new Date(cached.em).getTime() < 30_000) {
    estado = cached.estado;
    phone = cached.phone;
    verificadoEm = cached.em;
    detalhe = cached.detalhe;
  } else {
    try {
      if (!inst.phone_number_id || !inst.access_token) throw new Error('Cadastro sem acesso à Meta');
      const response = await fetch(`https://graph.facebook.com/v21.0/${inst.phone_number_id}?fields=health_status,status,quality_rating`, {
        headers: { Authorization: `Bearer ${inst.access_token}` }, signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error) throw new Error('A Meta não permitiu concluir a consulta');
      phone = body;
      estado = classificarPagamento(body.health_status, null);
      detalhe = estado === 'confirmado' ? 'BUSINESS e WABA disponíveis na Meta.'
        : estado === 'pendente' ? 'A Meta confirmou uma restrição comercial com motivo de pagamento.'
        : estado === 'outra_restricao' ? 'A Meta confirmou outra restrição comercial; pagamento irregular não foi confirmado.'
        : detalhe;
    } catch {
      detalhe = 'Consulta indisponível ou sem permissão; pagamento irregular não confirmado.';
    }
  }
  const snapshot = { estado, em: verificadoEm, detalhe, phone };
  const patch: any = { saude_raw: { ...(atual.saude_raw || {}), pagamento_verificacao: snapshot } };
  const motivoAnterior = String(atual.pausa_automatica_motivo || '');
  const travaPagamento = /131042|141006|payment|billing|pagamento|faturamento/i.test(motivoAnterior);
  const outraTrava = motivoAnterior && !travaPagamento;
  if (podeLimparTravaPagamento(atual, estado, phone)) {
    Object.assign(patch, { estado_pool: 'ativo', pausa_automatica_ate: null, pausa_automatica_motivo: null });
  } else if (estado !== 'confirmado' && !outraTrava && !atual.pool_fora_manual) {
    Object.assign(patch, {
      estado_pool: 'restrita',
      pausa_automatica_ate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      pausa_automatica_motivo: estado === 'pendente' ? 'Pagamento restrito confirmado pela Meta (#131042)'
        : estado === 'outra_restricao' ? 'Outra restrição comercial confirmada pela Meta; pagamento não confirmado'
        : 'Verificação de pagamento inconclusiva (#131042); aguardando revalidação',
    });
  }
  // Compare-and-set: never overwrite a new ban/manual restriction from another worker.
  let update = supabase.from('meta_whatsapp_instances').update(patch).eq('id', inst.id)
    .eq('pool_fora_manual', atual.pool_fora_manual === true);
  update = atual.pausa_automatica_motivo == null
    ? update.is('pausa_automatica_motivo', null) : update.eq('pausa_automatica_motivo', atual.pausa_automatica_motivo);
  const { data: changed, error } = await update.select('id').maybeSingle();
  if (error) throw new Error('Não foi possível atualizar a verificação de pagamento');
  const restringida = !changed || estado !== 'confirmado' ||
    (atual.estado_pool !== 'ativo' && patch.estado_pool !== 'ativo') || !!outraTrava || atual.pool_fora_manual === true;
  if (changed && estado === 'pendente') {
    const { notificarAdmin } = await import('./notificar-admin.ts');
    const hora = new Date(verificadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await notificarAdmin(supabase, {
      tipo: 'meta_instancia_restrita',
      mensagem: `⚠️ *Restrição de pagamento confirmada pela Meta*\n\nInstância: *${rotuloInstancia(inst)}*\nVerificação: ${hora} (Brasília).\n\nConsultamos a Meta novamente antes deste aviso e ela ainda informa restrição de pagamento (#131042). Um cartão cadastrado não garante a liberação. Confira faturas e método de pagamento na Meta.\n\nOs envios permanecem protegidos até a liberação ser confirmada; haverá nova revalidação pela rotina existente. Não é confirmação de banimento.`,
      chaveIdempotencia: `meta_pagamento_confirmado_${inst.id}_${verificadoEm.slice(0, 10)}`,
      umaVezPorChave: true,
    });
  }
  return { estado, restringida, detalhe, verificadoEm };
}