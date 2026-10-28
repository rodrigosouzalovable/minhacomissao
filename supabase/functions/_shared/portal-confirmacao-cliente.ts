// Confirmação ao cliente no WhatsApp após acordo fechado pelo portal.
// Usa a conversa mais recente do cliente no Inbox (casamento por sufixo de 8 dígitos)
// e envia pela rotina oficial de texto (janela 24h na Meta; UAZAPI sem janela).

export async function enviarConfirmacaoPortal(db: any, telefone: string, texto: string): Promise<{ ok: boolean; motivo: string }> {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (digits.length < 10) return { ok: false, motivo: 'telefone inválido' };
  const sufixo = digits.slice(-8);
  const { data: contatos } = await db.from('meta_whatsapp_contatos')
    .select('instancia_id, telefone, atualizado_em')
    .ilike('telefone', `%${sufixo}`)
    .order('atualizado_em', { ascending: false })
    .limit(5);
  if (!contatos?.length) return { ok: false, motivo: 'cliente sem conversa no Inbox' };

  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp-meta-text`;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  let ultimoErro = 'falha no envio';
  for (const c of contatos) {
    const { data: inst } = await db.from('meta_whatsapp_instances').select('user_id, ativo').eq('id', c.instancia_id).maybeSingle();
    if (!inst?.ativo) continue;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instancia_id: c.instancia_id, telefone: c.telefone, texto, user_id: inst.user_id, origem: 'portal' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.success) return { ok: true, motivo: 'enviado' };
      ultimoErro = String(j?.error || `HTTP ${r.status}`).slice(0, 160);
    } catch (e) { ultimoErro = String(e).slice(0, 160); }
  }
  return { ok: false, motivo: ultimoErro };
}
