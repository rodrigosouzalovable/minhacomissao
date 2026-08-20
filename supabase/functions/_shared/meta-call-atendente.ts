// Descobre para QUEM a chamada de entrada deve tocar.
// Regra: toca só para o atendente vinculado à conversa (etiqueta "Atendente: <nome>").
// Se a conversa estiver com o IAGO, a etiqueta é trocada em definitivo pelo próximo
// atendente humano do rodízio da caixa — e a ligação cai para essa pessoa.

async function nomeIagoAtual(supabase: any): Promise<string> {
  try {
    const { data: cfg } = await supabase.from('iago_config').select('user_id').limit(1).maybeSingle();
    if (cfg?.user_id) {
      const { data: p } = await supabase.from('profiles').select('nome').eq('id', cfg.user_id).maybeSingle();
      const n = String(p?.nome || '').trim().toLowerCase();
      if (n) return n;
    }
  } catch { /* usa padrão */ }
  return 'iago';
}

const soNome = (etiqueta: string) =>
  String(etiqueta || '').replace(/^atendente:\s*/i, '').trim();

async function userIdDaEtiqueta(supabase: any, nomeEtiqueta: string): Promise<string | null> {
  const nome = soNome(nomeEtiqueta);
  if (!nome) return null;
  const { data } = await supabase.from('profiles').select('id, nome').ilike('nome', `${nome}%`).limit(2);
  if (!data?.length) return null;
  const exato = data.find((p: any) => String(p.nome || '').trim().toLowerCase() === nome.toLowerCase());
  if (exato) return exato.id;
  return data.length === 1 ? data[0].id : null;
}

/** Retorna o user_id do atendente que deve receber o toque (ou null se não houver). */
export async function resolverAtendenteChamada(supabase: any, contatoId: string | null): Promise<string | null> {
  if (!contatoId) return null;
  try {
    const { data: vinculos } = await supabase
      .from('meta_whatsapp_contato_etiquetas')
      .select('etiqueta_id, meta_whatsapp_etiquetas!inner(id, nome)')
      .eq('contato_id', contatoId);

    const atendentes = (vinculos || [])
      .map((v: any) => v.meta_whatsapp_etiquetas)
      .filter((e: any) => e && /^atendente:/i.test(String(e.nome || '')));

    const iago = await nomeIagoAtual(supabase);
    const ehIago = (nome: string) => {
      const n = soNome(nome).toLowerCase();
      return n === iago || n.startsWith('iago');
    };

    const humano = atendentes.find((e: any) => !ehIago(e.nome));
    if (humano) return await userIdDaEtiqueta(supabase, humano.nome);

    // Conversa com o IAGO (ou sem atendente): transfere em definitivo para o rodízio
    const doIago = atendentes.filter((e: any) => ehIago(e.nome));
    if (doIago.length) {
      await supabase
        .from('meta_whatsapp_contato_etiquetas')
        .delete()
        .eq('contato_id', contatoId)
        .in('etiqueta_id', doIago.map((e: any) => e.id));
      console.log('[MetaCallAtendente] etiqueta do IAGO removida para transferir a ligação', { contatoId });
    }

    const { data: escolhida, error } = await supabase
      .rpc('atribuir_atendente_rodizio', { p_contato_id: contatoId });
    if (error) {
      console.error('[MetaCallAtendente] rodízio falhou', error.message);
      return null;
    }
    if (!escolhida) return null;

    const { data: et } = await supabase
      .from('meta_whatsapp_etiquetas').select('nome').eq('id', escolhida).maybeSingle();
    const uid = et?.nome ? await userIdDaEtiqueta(supabase, et.nome) : null;
    console.log('[MetaCallAtendente] ligação transferida pelo rodízio', { contatoId, etiqueta: et?.nome, uid });
    return uid;
  } catch (e: any) {
    console.error('[MetaCallAtendente] erro ao resolver atendente', e?.message || e);
    return null;
  }
}
