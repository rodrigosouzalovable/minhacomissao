import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeia status da Meta -> status interno do app
function mapStatusMeta(s: string): string {
  switch (s) {
    case 'sent': return 'enviada';
    case 'delivered': return 'entregue';
    case 'read': return 'lida';
    case 'failed': return 'erro';
    default: return 'enviada';
  }
}

function extractTextoFromMessage(m: any): { texto: string; tipo: string; media_url: string | null } {
  const tipo = m.type || 'texto';
  if (m.text?.body) return { texto: m.text.body, tipo: 'texto', media_url: null };
  if (m.button?.text) return { texto: m.button.text, tipo: 'texto', media_url: null };
  if (m.interactive?.button_reply?.title) return { texto: m.interactive.button_reply.title, tipo: 'texto', media_url: null };
  if (m.interactive?.list_reply?.title) return { texto: m.interactive.list_reply.title, tipo: 'texto', media_url: null };
  if (tipo === 'image') return { texto: m.image?.caption || '[Imagem]', tipo: 'imagem', media_url: null };
  if (tipo === 'audio') return { texto: '[Áudio]', tipo: 'audio', media_url: null };
  if (tipo === 'document') return { texto: m.document?.filename || '[Documento]', tipo: 'documento', media_url: null };
  if (tipo === 'video') return { texto: m.video?.caption || '[Vídeo]', tipo: 'video', media_url: null };
  return { texto: `[${tipo}]`, tipo: 'texto', media_url: null };
}

function normalizePhone(tel: any): string {
  return String(tel || '').replace(/\D/g, '');
}

function phoneSuffix(tel: any): string {
  const d = normalizePhone(tel);
  return d.length >= 8 ? d.slice(-8) : '';
}

function samePhoneBySuffix(a: any, b: any): boolean {
  const sa = phoneSuffix(a);
  const sb = phoneSuffix(b);
  return !!sa && !!sb && sa === sb;
}

function isOfficialInstancePhoneSuffix(sufixo: string, currentInstanceId: string, instances: any[]): boolean {
  if (!sufixo) return false;
  return instances.some((i) => i?.id !== currentInstanceId && phoneSuffix(i?.display_phone) === sufixo);
}

async function hasOutboundTemplateContext(supabase: any, instanciaId: string, sufixo: string): Promise<boolean> {
  if (!sufixo) return false;
  const { data } = await supabase
    .from('meta_whatsapp_envios_log')
    .select('id')
    .eq('instancia_id', instanciaId)
    .ilike('telefone', `%${sufixo}`)
    .neq('status', 'failed')
    .order('enviado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  return !!data?.id;
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/webm': 'webm', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'video/webm': 'webm',
  'application/pdf': 'pdf',
};

function extractMediaId(m: any): { mediaId: string | null; mime: string | null } {
  const t = m.type;
  if (t === 'image' && m.image?.id) return { mediaId: m.image.id, mime: m.image.mime_type || 'image/jpeg' };
  if (t === 'audio' && m.audio?.id) return { mediaId: m.audio.id, mime: m.audio.mime_type || 'audio/ogg' };
  if (t === 'video' && m.video?.id) return { mediaId: m.video.id, mime: m.video.mime_type || 'video/mp4' };
  if (t === 'document' && m.document?.id) return { mediaId: m.document.id, mime: m.document.mime_type || 'application/pdf' };
  if (t === 'sticker' && m.sticker?.id) return { mediaId: m.sticker.id, mime: m.sticker.mime_type || 'image/webp' };
  return { mediaId: null, mime: null };
}

async function baixarMidiaMeta(
  supabase: any, accessToken: string, mediaId: string, mime: string, instanciaId: string, waMessageId: string
): Promise<string | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.error('[MetaWebhook] falha metadata mídia', mediaId, metaRes.status);
      return null;
    }
    const meta = await metaRes.json();
    const url = meta?.url;
    if (!url) return null;

    const binRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!binRes.ok) {
      console.error('[MetaWebhook] falha download mídia', mediaId, binRes.status);
      return null;
    }
    const buf = new Uint8Array(await binRes.arrayBuffer());
    const ext = MIME_EXT[mime.toLowerCase()] || (mime.split('/')[1] || 'bin');
    const safeMsgId = String(waMessageId || crypto.randomUUID()).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `meta/${instanciaId}/${safeMsgId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('inbox-media')
      .upload(path, buf, { contentType: mime, upsert: true });
    if (upErr) {
      console.error('[MetaWebhook] falha upload mídia', upErr.message);
      return null;
    }
    const { data: pub } = supabase.storage.from('inbox-media').getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (e) {
    console.error('[MetaWebhook] erro baixarMidiaMeta', e instanceof Error ? e.message : e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // GET → Meta verify challenge
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const { data: config } = await supabase
      .from('meta_whatsapp_config')
      .select('valor')
      .eq('chave', 'webhook_verify_token')
      .maybeSingle();

    const expected = config?.valor;

    if (mode === 'subscribe' && token === expected && challenge) {
      return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    return new Response('forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const firstEntry = payload?.entry?.[0]?.changes?.[0];
    console.log('[MetaWebhook] POST recebido', {
      object: payload?.object,
      field: firstEntry?.field,
      phone_number_id: firstEntry?.value?.metadata?.phone_number_id,
      messages: firstEntry?.value?.messages?.length || 0,
      message_echoes: firstEntry?.value?.message_echoes?.length || 0,
      statuses: firstEntry?.value?.statuses?.length || 0,
    });

    const { data: officialInstances } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, display_phone')
      .eq('ativo', true);

    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      const wabaIdEntry = entry.id || null;
      for (const change of changes) {
        const value = change.value || {};
        const fieldRaw = String(change.field || '').toLowerCase();

        // ===== Alertas de Billing / Account =====
        if (fieldRaw === 'account_alerts' || fieldRaw === 'account_update' || fieldRaw === 'phone_number_quality_update') {
          try {
            let tipo = 'account_update';
            let valorUsd: number | null = null;
            if (fieldRaw === 'account_alerts') {
              tipo = value?.alert_type || value?.event || 'account_alert';
              valorUsd = Number(value?.amount_spent_since_last_bill || value?.amount || 0) || null;
            } else if (fieldRaw === 'phone_number_quality_update') {
              tipo = 'quality_update';
            } else {
              tipo = value?.event || 'account_update';
            }
            const fxRes = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL').catch(() => null);
            const fxJson = fxRes && fxRes.ok ? await fxRes.json().catch(() => null) : null;
            const fxRate = Number(fxJson?.USDBRL?.bid || 5.5);
            const valorBrl = valorUsd ? Number((valorUsd * fxRate).toFixed(2)) : null;

            const { data: alertRow } = await supabase.from('meta_billing_alerts').insert({
              waba_id: wabaIdEntry,
              tipo,
              valor_usd: valorUsd,
              valor_brl: valorBrl,
              detalhes: value,
            }).select('id').maybeSingle();

            // Dispara notificação WhatsApp ao admin
            try {
              const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
              const brl = (v: number | null) => v == null ? '-' : `R$ ${v.toFixed(2).replace('.', ',')}`;
              const usd = valorUsd ? `US$ ${valorUsd.toFixed(2)}` : '';
              const mensagem = `💳 *Alerta Meta WhatsApp*\n\n*Tipo:* ${tipo}\n${usd ? `*Valor:* ${usd} (~${brl(valorBrl)})\n` : ''}*WABA:* ${wabaIdEntry || '-'}\n*Horário:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
              await notificarAdmin(supabase, {
                tipo: 'meta_billing_alert',
                mensagem,
                chaveIdempotencia: alertRow?.id || `${tipo}-${Date.now()}`,
              });
              if (alertRow?.id) {
                await supabase.from('meta_billing_alerts').update({ notificado_em: new Date().toISOString() }).eq('id', alertRow.id);
              }
            } catch (e) {
              console.error('[MetaWebhook] falha ao notificar admin billing', e);
            }
          } catch (e) {
            console.error('[MetaWebhook] erro processando alerta billing', e);
          }
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const { data: inst } = await supabase
          .from('meta_whatsapp_instances').select('id, user_id, display_phone, access_token')
          .eq('phone_number_id', phoneNumberId).maybeSingle();
        if (!inst) continue;

          const businessDigits = normalizePhone(inst.display_phone || value.metadata?.display_phone_number);
        const fieldName = String(change.field || '').toLowerCase();
        const isEchoField = fieldName === 'message_echoes' || fieldName === 'smb_message_echoes';

        // ===== Mensagens recebidas =====
        const messages = isEchoField ? (value.message_echoes || value.messages || []) : (value.messages || []);
        const contacts = value.contacts || [];
        const nomePorWaId: Record<string, string> = {};
        // Novo: mapa de BSUID (user_id) e username por wa_id / BSUID
        // Meta 2026: contact.user_id = BSUID (ex: BR.1349...) ; contact.username = @handle
        const bsuidPorWaId: Record<string, string> = {};
        const usernamePorWaId: Record<string, string> = {};
        const nomePorBsuid: Record<string, string> = {};
        for (const c of contacts) {
          const waId = c?.wa_id || null;
          const bsuid = c?.user_id || c?.userId || null;
          const uname = c?.username || null;
          const nome = c?.profile?.name || null;
          if (waId && nome) nomePorWaId[waId] = nome;
          if (waId && bsuid) bsuidPorWaId[waId] = bsuid;
          if (waId && uname) usernamePorWaId[waId] = uname;
          if (bsuid && nome) nomePorBsuid[bsuid] = nome;
          if (bsuid && uname) usernamePorWaId[bsuid] = uname;
        }

        for (const m of messages) {
          const from = normalizePhone(m.from);
          // Meta 2026: pode vir só BSUID sem telefone (username-only)
          const msgBsuid: string | null = m.from_user_id || m.from_userId || m.user_id || bsuidPorWaId[m.from] || null;
          if (!from && !msgBsuid) continue;
          const { texto, tipo } = extractTextoFromMessage(m);
          const tsMsg = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
          const nomeContato = nomePorWaId[from] || (msgBsuid ? nomePorBsuid[msgBsuid] : null) || null;
          const usernameContato = usernamePorWaId[from] || (msgBsuid ? usernamePorWaId[msgBsuid] : null) || null;

          // Echo: mensagem enviada pelo próprio número (WhatsApp Web / celular via coexistência)
          const fromDigits = normalizePhone(from);
          const isEcho = isEchoField || (!!businessDigits && !!fromDigits && (fromDigits === businessDigits || samePhoneBySuffix(fromDigits, businessDigits)));

          // Para echoes: destinatário está em m.to; em mensagens recebidas, o outro lado é m.from
          let outroLado = isEcho
            ? normalizePhone(m.to || contacts?.[0]?.wa_id || null)
            : from;
          const soBsuid = !outroLado && !!msgBsuid;
          if (!outroLado && !soBsuid) continue;

          // Casa telefone pelo sufixo (últimos 8 dígitos) para unificar variações
          // com/sem "9" do celular brasileiro entre envio (5562981079590) e resposta (556281079590)
          const sufixo = phoneSuffix(outroLado);
          if (!soBsuid && sufixo.length === 8) {
            const { data: contatoCanonico } = await supabase
              .from('meta_whatsapp_contatos')
              .select('telefone')
              .eq('instancia_id', inst.id)
              .ilike('telefone', `%${sufixo}`)
              .neq('telefone', outroLado)
              .order('atualizado_em', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (contatoCanonico?.telefone) {
              outroLado = contatoCanonico.telefone;
            } else {
              const { data: envioCanonico } = await supabase
                .from('meta_whatsapp_envios_log')
                .select('telefone')
                .eq('instancia_id', inst.id)
                .ilike('telefone', `%${sufixo}`)
                .neq('telefone', outroLado)
                .order('enviado_em', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (envioCanonico?.telefone) {
                outroLado = envioCanonico.telefone;
              }
            }
          }

          // Se o outro lado também é um número oficial cadastrado no sistema,
          // a Meta pode enviar um webhook espelho pela outra instância (coexistência/WhatsApp Web).
          // Mantemos apenas quando a instância atual iniciou o atendimento via template HSM;
          // caso contrário, não cria conversa duplicada no Inbox Meta.
          if (!soBsuid && isOfficialInstancePhoneSuffix(sufixo, inst.id, officialInstances || [])) {
            const hasTemplateContext = await hasOutboundTemplateContext(supabase, inst.id, sufixo);
            if (!hasTemplateContext) {
              console.log('[MetaWebhook] ignorando conversa espelho entre instâncias oficiais', {
                instancia_id: inst.id,
                telefone: outroLado,
                sufixo,
                field: fieldName,
                isEcho,
              });
              continue;
            }
          }

          // Baixar mídia (imagem/áudio/vídeo/documento/sticker) via Graph API e salvar no storage público
          let mediaUrl: string | null = null;
          const { mediaId, mime } = extractMediaId(m);
          if (mediaId && mime && inst.access_token) {
            mediaUrl = await baixarMidiaMeta(supabase, inst.access_token, mediaId, mime, inst.id, m.id || mediaId);
          }

          // Insere mensagem (dedup via UNIQUE instancia_id + wa_message_id — envios feitos pelo próprio sistema não duplicam)
          const { error: msgError } = await supabase.from('meta_whatsapp_mensagens').insert({
            user_id: inst.user_id,
            instancia_id: inst.id,
            telefone: outroLado || null,
            bsuid: msgBsuid,
            direcao: isEcho ? 'saida' : 'entrada',
            conteudo: texto,
            tipo_conteudo: tipo,
            media_url: mediaUrl,
            timestamp_msg: tsMsg,
            status_envio: isEcho ? 'enviada' : 'entregue',
            wa_message_id: m.id,
          } as any);

          if (msgError) {
            const duplicate = String(msgError.message || '').toLowerCase().includes('duplicate') || msgError.code === '23505';
            if (!duplicate) console.error('[MetaWebhook] erro ao inserir mensagem', { field: fieldName, isEcho, erro: msgError.message });
          }

          // Upsert contato — chave primária: BSUID quando disponível, senão telefone
          let existenteQuery = supabase
            .from('meta_whatsapp_contatos')
            .select('id, nao_lido, nome, bsuid, telefone, whatsapp_username')
            .eq('instancia_id', inst.id);
          if (msgBsuid) {
            existenteQuery = existenteQuery.eq('bsuid', msgBsuid);
          } else {
            existenteQuery = existenteQuery.eq('telefone', outroLado);
          }
          const { data: existente } = await existenteQuery.maybeSingle();

          // Fallback: se não achou por BSUID mas tem telefone, tenta casar por telefone p/ correlacionar
          let existenteFinal = existente;
          if (!existenteFinal && msgBsuid && outroLado) {
            const { data: existentePorTel } = await supabase
              .from('meta_whatsapp_contatos')
              .select('id, nao_lido, nome, bsuid, telefone, whatsapp_username')
              .eq('instancia_id', inst.id)
              .eq('telefone', outroLado)
              .maybeSingle();
            existenteFinal = existentePorTel;
          }

          let contatoIdFinal: string | null = existenteFinal?.id ?? null;
          if (existenteFinal) {
            const upd: any = {
              ultima_mensagem: texto,
              ultima_mensagem_em: tsMsg,
              atualizado_em: new Date().toISOString(),
            };
            // Correlaciona BSUID/username/telefone quando chega dado novo
            if (msgBsuid && !existenteFinal.bsuid) upd.bsuid = msgBsuid;
            if (usernameContato && !existenteFinal.whatsapp_username) upd.whatsapp_username = usernameContato;
            if (outroLado && !existenteFinal.telefone) {
              upd.telefone = outroLado;
              upd.telefone_visivel = true;
            }
            if (isEcho) {
              // envio nosso — não incrementa não-lido, não atualiza ultima_msg_entrada_em/interacao
            } else {
              upd.ultima_msg_entrada_em = tsMsg;
              upd.ultima_interacao_em = tsMsg;
              upd.nao_lido = (existenteFinal.nao_lido || 0) + 1;
              upd.nome = existenteFinal.nome || nomeContato;
            }
            await supabase.from('meta_whatsapp_contatos').update(upd).eq('id', existenteFinal.id);
          } else {
            const { data: inseridoContato } = await supabase.from('meta_whatsapp_contatos').insert({
              user_id: inst.user_id,
              instancia_id: inst.id,
              telefone: outroLado || null,
              telefone_visivel: !!outroLado,
              bsuid: msgBsuid,
              whatsapp_username: usernameContato,
              nome: isEcho ? null : nomeContato,
              ultima_mensagem: texto,
              ultima_mensagem_em: tsMsg,
              ultima_msg_entrada_em: isEcho ? null : tsMsg,
              ultima_interacao_em: isEcho ? null : tsMsg,
              nao_lido: isEcho ? 0 : 1,
            } as any).select('id').maybeSingle();
            contatoIdFinal = (inseridoContato as any)?.id ?? null;
          }

          // ===== Rodízio de atendentes =====
          // Se a mensagem é do cliente (entrada) e a conversa ainda não tem
          // nenhuma etiqueta "Atendente: X", atribui automaticamente a etiqueta
          // do atendente com menor carga atual (desempate alfabético).
          if (!isEcho && contatoIdFinal) {
            try {
              const { data: atendentes } = await supabase
                .from('meta_whatsapp_etiquetas')
                .select('id, nome')
                .eq('user_id', inst.user_id)
                .ilike('nome', 'Atendente:%');

              if (atendentes && atendentes.length > 0) {
                const atendenteIds = atendentes.map((a: any) => a.id);

                // Já tem atendente atribuído?
                const { data: jaAtribuido } = await supabase
                  .from('meta_whatsapp_contato_etiquetas')
                  .select('etiqueta_id')
                  .eq('contato_id', contatoIdFinal)
                  .in('etiqueta_id', atendenteIds)
                  .limit(1);

                if (!jaAtribuido || jaAtribuido.length === 0) {
                  // Conta carga de cada atendente
                  const { data: vinculos } = await supabase
                    .from('meta_whatsapp_contato_etiquetas')
                    .select('etiqueta_id')
                    .in('etiqueta_id', atendenteIds);

                  const carga: Record<string, number> = {};
                  for (const id of atendenteIds) carga[id] = 0;
                  for (const v of (vinculos || [])) {
                    const eid = (v as any).etiqueta_id;
                    if (eid in carga) carga[eid] += 1;
                  }

                  const ordenados = [...atendentes].sort((a: any, b: any) => {
                    const ca = carga[a.id] ?? 0;
                    const cb = carga[b.id] ?? 0;
                    if (ca !== cb) return ca - cb;
                    return String(a.nome).localeCompare(String(b.nome));
                  });
                  const escolhido: any = ordenados[0];

                  const { error: linkErr } = await supabase
                    .from('meta_whatsapp_contato_etiquetas')
                    .insert({ contato_id: contatoIdFinal, etiqueta_id: escolhido.id } as any);

                  if (linkErr) {
                    const dup = String(linkErr.message || '').toLowerCase().includes('duplicate') || linkErr.code === '23505';
                    if (!dup) {
                      console.error('[MetaWebhook] falha ao atribuir atendente', linkErr.message);
                    }
                  } else {
                    console.log('[MetaWebhook] atendente atribuido', {
                      contato_id: contatoIdFinal,
                      etiqueta_id: escolhido.id,
                      atendente: escolhido.nome,
                    });
                  }
                }
              }
            } catch (e: any) {
              console.error('[MetaWebhook] erro no rodízio de atendentes', e?.message || e);
            }
          }

          // Compatibilidade com o log de envios em massa — casa por sufixo
          if (!isEcho && !soBsuid && sufixo.length === 8) {
            await supabase.from('meta_whatsapp_envios_log')
              .update({ status: 'replied' })
              .eq('instancia_id', inst.id)
              .ilike('telefone', `%${sufixo}`)
              .neq('status', 'replied');
          }



        }

        // ===== Atualizações de status =====
        const statuses = value.statuses || [];
        for (const s of statuses) {
          const waId = s.id;
          const status = s.status; // sent | delivered | read | failed
          if (!waId) continue;

          const novoStatus = mapStatusMeta(status);

          // Atualiza mensagem do inbox
          await supabase.from('meta_whatsapp_mensagens')
            .update({
              status_envio: novoStatus,
              erro: status === 'failed' ? (s.errors?.[0]?.title || s.errors?.[0]?.message || 'falha') : null,
            })
            .eq('wa_message_id', waId);

          // Compatibilidade com log de massa
          await supabase.from('meta_whatsapp_envios_log')
            .update({ status })
            .eq('wa_message_id', waId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[MetaWebhook] erro:', err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
