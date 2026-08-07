// Follow-up único do IAGO: se o cliente não respondeu, retoma UMA vez algumas horas depois,
// somente dentro da janela permitida (padrão 08h–19h BRT) e dentro das 24h da última
// mensagem do cliente (janela oficial da Meta para mensagem livre).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders, json, agoraSP, primeiroNome, carregarConfig, perfilIago, iagoAtendeCaixa,
  etiquetasAtendente, enviarTexto,
} from '../_shared/iago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const cfg = await carregarConfig(supabase);
    if (!cfg?.ativo || !cfg?.followup_ativo) return json({ success: true, skipped: 'follow-up desligado' });

    const hora = agoraSP().getHours();
    const hIni = Number(cfg.followup_hora_inicio ?? 8);
    const hFim = Number(cfg.followup_hora_fim ?? 19);
    if (hora < hIni || hora >= hFim) return json({ success: true, skipped: `fora da janela ${hIni}h-${hFim}h` });

    const iago = await perfilIago(supabase, cfg);
    if (!iago?.id) return json({ success: true, skipped: 'usuário do IAGO não encontrado' });

    const agora = new Date();
    const { data: pendentes } = await supabase
      .from('iago_conversa_estado')
      .select('*')
      .eq('followup_feito', false)
      .eq('optout', false)
      .eq('aguardando_humano', false)
      .not('followup_em', 'is', null)
      .lte('followup_em', agora.toISOString())
      .limit(40);

    let enviados = 0;
    const pulados: string[] = [];

    for (const est of (pendentes || []) as any[]) {
      const { data: contato } = await supabase
        .from('meta_whatsapp_contatos')
        .select('id, instancia_id, telefone, bsuid, nome, folder_id, ultima_msg_entrada_em')
        .eq('id', est.contato_id)
        .maybeSingle();
      if (!contato) { pulados.push('contato inexistente'); continue; }

      // Cliente respondeu depois do nosso último envio? => follow-up desnecessário
      const { data: entradas } = await supabase
        .from('meta_whatsapp_mensagens')
        .select('id')
        .eq('instancia_id', (contato as any).instancia_id)
        .eq('telefone', (contato as any).telefone || '')
        .eq('direcao', 'entrada')
        .gt('criado_em', String(est.ultima_msg_em || est.created_at))
        .limit(1);
      if ((entradas || []).length) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_em: null }).eq('id', est.id);
        pulados.push('cliente respondeu');
        continue;
      }

      // Janela de 24h da Meta precisa estar aberta
      const ultimaEntrada = (contato as any).ultima_msg_entrada_em
        ? new Date((contato as any).ultima_msg_entrada_em).getTime() : 0;
      if (!ultimaEntrada || agora.getTime() - ultimaEntrada >= 24 * 60 * 60 * 1000) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
        pulados.push('janela 24h fechada');
        continue;
      }

      // A conversa continua sendo do IAGO e na caixa dele?
      const atende = await iagoAtendeCaixa(supabase, iago.id, (contato as any).folder_id ?? null);
      const tags = await etiquetasAtendente(supabase, (contato as any).id);
      const nomeIago = String(iago.nome || '').trim().toLowerCase();
      const ehDoIago = tags.some((t) => t.replace(/^atendente:\s*/i, '').trim().toLowerCase() === nomeIago);
      if (!atende || !ehDoIago) {
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
        pulados.push('conversa não é do IAGO');
        continue;
      }

      const nome = primeiroNome((contato as any).nome);
      const base = String(cfg.followup_texto || 'Oi, tudo bem? Só passando pra saber se você viu a proposta que te mandei.');
      const texto = nome ? `${nome}, ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;

      try {
        const id = await enviarTexto(supabase, contato, texto);
        const ids = Array.isArray(est.contexto?.msgs_ia) ? est.contexto.msgs_ia : [];
        await supabase.from('iago_conversa_estado').update({
          followup_feito: true,
          followup_em: null,
          etapa: 'followup',
          ultima_msg_em: new Date().toISOString(),
          contexto: {
            ...(est.contexto || {}),
            msgs_ia: [...ids, ...(id ? [id] : [])].slice(-30),
            ultimo_envio_ia: new Date(Date.now() + 2000).toISOString(),
          },
        }).eq('id', est.id);
        enviados += 1;
      } catch (e: any) {
        console.error('[IAGO followup] falha no envio', e?.message || e);
        await supabase.from('iago_conversa_estado')
          .update({ followup_feito: true, followup_em: null }).eq('id', est.id);
      }
    }

    console.log('[IAGO followup]', { candidatos: (pendentes || []).length, enviados, pulados });
    return json({ success: true, candidatos: (pendentes || []).length, enviados, pulados });
  } catch (e: any) {
    console.error('[IAGO followup] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});
