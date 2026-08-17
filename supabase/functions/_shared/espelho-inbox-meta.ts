// Espelhamento das conversas das instâncias NÃO OFICIAIS (UAZAPI / aba Acionamento)
// dentro do Inbox Meta Oficial, na caixa configurada (por padrão AQUECIMENTO).
//
// Motivo: o Inbox Meta e o IAGO operam sobre meta_whatsapp_contatos / meta_whatsapp_mensagens.
// Ao espelhar, os números conectados via UAZAPI passam a aparecer na caixa e o IAGO
// atende essas conversas com exatamente as mesmas regras das instâncias oficiais.

export interface InstanciaEspelho {
  id: string;
  user_id: string;
  nome: string;
  provider: string;
  folder_padrao_id: string | null;
  uazapi_instance_id: string | null;
}

/** Retorna a instância espelho (provider='uazapi') vinculada a uma instância do Acionamento. */
export async function buscarInstanciaEspelho(
  supabase: any,
  uazapiInstanceId: string,
): Promise<InstanciaEspelho | null> {
  const { data } = await supabase
    .from('meta_whatsapp_instances')
    .select('id, user_id, nome, provider, folder_padrao_id, uazapi_instance_id')
    .eq('uazapi_instance_id', uazapiInstanceId)
    .eq('provider', 'uazapi')
    .eq('ativo', true)
    .maybeSingle();
  return (data as InstanciaEspelho) || null;
}

export interface EspelhoMensagem {
  telefone: string;
  nome?: string | null;
  conteudo: string;
  tipoConteudo?: string;
  mediaUrl?: string | null;
  waMessageId?: string | null;
  direcao: 'entrada' | 'saida';
  timestamp?: string;
}

export interface ResultadoEspelho {
  contatoId: string | null;
  mensagemId: string | null;
  duplicada: boolean;
  instancia: InstanciaEspelho | null;
}

/**
 * Espelha uma mensagem (entrada ou saída) de uma instância UAZAPI no Inbox Meta.
 * Faz casamento de contato pelo sufixo de 8 dígitos e dedupe por wa_message_id.
 */
export async function espelharMensagemInboxMeta(
  supabase: any,
  uazapiInstanceId: string,
  msg: EspelhoMensagem,
): Promise<ResultadoEspelho> {
  const vazio: ResultadoEspelho = { contatoId: null, mensagemId: null, duplicada: false, instancia: null };

  const inst = await buscarInstanciaEspelho(supabase, uazapiInstanceId);
  if (!inst) return vazio;

  const digits = String(msg.telefone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return { ...vazio, instancia: inst };
  const sufixo = digits.slice(-8);
  const agora = msg.timestamp || new Date().toISOString();

  // Dedupe por wa_message_id na mesma instância espelho
  if (msg.waMessageId) {
    const { data: dup } = await supabase
      .from('meta_whatsapp_mensagens')
      .select('id')
      .eq('instancia_id', inst.id)
      .eq('wa_message_id', msg.waMessageId)
      .limit(1)
      .maybeSingle();
    if ((dup as any)?.id) {
      return { contatoId: null, mensagemId: (dup as any).id, duplicada: true, instancia: inst };
    }
  }

  // Contato: reaproveita o formato de telefone já existente (sufixo 8 dígitos)
  const { data: achados } = await supabase
    .from('meta_whatsapp_contatos')
    .select('id, telefone, nao_lido, nome, cpf')
    .eq('instancia_id', inst.id)
    .ilike('telefone', `%${sufixo}`)
    .order('atualizado_em', { ascending: false })
    .limit(1);
  const contato = Array.isArray(achados) && achados.length ? achados[0] : null;
  const telefoneFinal = (contato as any)?.telefone || (digits.startsWith('55') ? digits : `55${digits}`);

  let contatoId: string | null = (contato as any)?.id || null;
  const preview = String(msg.conteudo || '').slice(0, 200);

  if (contatoId) {
    const upd: Record<string, unknown> = {
      ultima_mensagem: preview,
      ultima_mensagem_em: agora,
      atualizado_em: agora,
      arquivado: false,
    };
    if (msg.direcao === 'entrada') {
      upd.ultima_msg_entrada_em = agora;
      upd.ultima_interacao_em = agora;
      upd.nao_lido = ((contato as any)?.nao_lido || 0) + 1;
      if (msg.nome && !(contato as any)?.nome) upd.nome = msg.nome;
    }
    await supabase.from('meta_whatsapp_contatos').update(upd).eq('id', contatoId);
  } else {
    const { data: novo } = await supabase
      .from('meta_whatsapp_contatos')
      .insert({
        user_id: inst.user_id,
        instancia_id: inst.id,
        folder_id: inst.folder_padrao_id,
        telefone: telefoneFinal,
        telefone_visivel: true,
        nome: msg.nome || null,
        ultima_mensagem: preview,
        ultima_mensagem_em: agora,
        ultima_msg_entrada_em: msg.direcao === 'entrada' ? agora : null,
        ultima_interacao_em: msg.direcao === 'entrada' ? agora : null,
        nao_lido: msg.direcao === 'entrada' ? 1 : 0,
      } as any)
      .select('id')
      .maybeSingle();
    contatoId = (novo as any)?.id || null;
  }

  const { data: msgRow, error: msgErr } = await supabase
    .from('meta_whatsapp_mensagens')
    .insert({
      user_id: inst.user_id,
      instancia_id: inst.id,
      telefone: telefoneFinal,
      direcao: msg.direcao,
      conteudo: msg.conteudo || '',
      tipo_conteudo: msg.tipoConteudo || 'texto',
      media_url: msg.mediaUrl || null,
      timestamp_msg: agora,
      status_envio: msg.direcao === 'saida' ? 'enviada' : 'recebida',
      wa_message_id: msg.waMessageId || null,
    } as any)
    .select('id')
    .maybeSingle();

  if (msgErr) console.error('[espelho-inbox-meta] erro ao gravar mensagem:', msgErr.message);

  return {
    contatoId,
    mensagemId: (msgRow as any)?.id || null,
    duplicada: false,
    instancia: inst,
  };
}
