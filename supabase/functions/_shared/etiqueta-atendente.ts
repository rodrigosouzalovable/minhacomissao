// Aplica a etiqueta "Atendente: <Nome>" ao contato do Inbox Meta no momento do envio,
// sem esperar resposta do cliente.
// Regra: quem vale é o ATENDENTE NOMEADO na mensagem (não o remetente técnico do disparo).
// O atendente precisa ter permissão "Atende no Inbox Meta Oficial" e ser responsável
// pela caixa da conversa (caixa Padrão = meta_inbox_default_members).
// O sistema nunca cria etiquetas — só usa etiquetas já existentes.

export async function aplicarEtiquetaAtendente(
  supabase: any,
  opts: {
    contatoId: string;
    atendenteNome: string;
    /** dono das etiquetas (user_id da instância) */
    ownerUserId: string;
    /** apenas etiqueta se a conversa ainda não tiver etiqueta de atendente */
    somenteSeSemEtiqueta?: boolean;
    logPrefix?: string;
  },
): Promise<{ ok: boolean; motivo?: string; etiqueta_id?: string }> {
  const log = (...a: any[]) => console.log(opts.logPrefix || '[etiqueta-atendente]', ...a);
  const nome = String(opts.atendenteNome || '').trim();
  if (!nome || !opts.contatoId) return { ok: false, motivo: 'sem_nome_ou_contato' };

  try {
    // Caixa do contato
    const { data: cRow } = await supabase
      .from('meta_whatsapp_contatos')
      .select('folder_id')
      .eq('id', opts.contatoId)
      .maybeSingle();
    const folderId = (cRow as any)?.folder_id ?? null;

    if (opts.somenteSeSemEtiqueta) {
      const { data: jaTem } = await supabase
        .from('meta_whatsapp_contato_etiquetas')
        .select('etiqueta_id, meta_whatsapp_etiquetas!inner(nome)')
        .eq('contato_id', opts.contatoId);
      const temAtendente = (jaTem ?? []).some((r: any) =>
        String(r?.meta_whatsapp_etiquetas?.nome || '').toLowerCase().startsWith('atendente:')
      );
      if (temAtendente) return { ok: false, motivo: 'ja_tem_etiqueta_atendente' };
    }

    // Candidatas: etiquetas "Atendente: <primeiro nome>%"
    const primeiro = nome.split(/\s+/)[0];
    const { data: etiqs } = await supabase
      .from('meta_whatsapp_etiquetas')
      .select('id, nome')
      .eq('user_id', opts.ownerUserId)
      .ilike('nome', `Atendente: ${primeiro}%`);
    const candidatas = (etiqs ?? []).sort(
      (a: any, b: any) => String(b.nome).length - String(a.nome).length,
    );
    if (candidatas.length === 0) {
      log('etiqueta inexistente, ignorando:', `Atendente: ${primeiro}%`);
      return { ok: false, motivo: 'etiqueta_inexistente' };
    }

    // Escolhe a primeira candidata cujo atendente é elegível
    for (const etiq of candidatas) {
      const nomeAtendente = String(etiq.nome).replace(/^Atendente:\s*/i, '').trim();
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nome')
        .ilike('nome', nomeAtendente);
      const prof = (profs ?? [])[0];
      if (!prof?.id) continue;

      const { data: perm } = await supabase
        .from('user_permissions')
        .select('atende_inbox_meta')
        .eq('user_id', prof.id)
        .maybeSingle();
      if (perm && (perm as any).atende_inbox_meta === false) {
        log('atendente sem permissão de inbox:', nomeAtendente);
        continue;
      }

      let ehResponsavel = false;
      if (folderId) {
        const { data: m } = await supabase
          .from('meta_inbox_folder_members')
          .select('user_id')
          .eq('folder_id', folderId)
          .eq('user_id', prof.id)
          .maybeSingle();
        ehResponsavel = !!m;
      } else {
        const { data: m } = await supabase
          .from('meta_inbox_default_members')
          .select('user_id')
          .eq('user_id', prof.id)
          .maybeSingle();
        ehResponsavel = !!m;
      }
      if (!ehResponsavel) {
        log('atendente não é responsável pela caixa:', nomeAtendente, folderId);
        continue;
      }

      const { error: linkErr } = await supabase
        .from('meta_whatsapp_contato_etiquetas')
        .insert({ contato_id: opts.contatoId, etiqueta_id: etiq.id, origem: 'auto_atendente' } as any);
      if (
        linkErr && linkErr.code !== '23505' &&
        !String(linkErr.message || '').toLowerCase().includes('duplicate')
      ) {
        log('falha ao vincular etiqueta:', linkErr.message);
        return { ok: false, motivo: linkErr.message };
      }
      log('etiqueta aplicada no envio:', etiq.nome);
      return { ok: true, etiqueta_id: etiq.id };
    }

    return { ok: false, motivo: 'atendente_nao_elegivel' };
  } catch (e) {
    log('erro:', String(e).slice(0, 200));
    return { ok: false, motivo: 'erro' };
  }
}
