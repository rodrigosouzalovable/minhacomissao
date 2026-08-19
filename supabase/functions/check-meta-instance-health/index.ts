// Verifica saúde das instâncias Meta WhatsApp via Graph API.
// Retorna status (CONNECTED/FLAGGED/RESTRICTED/etc), quality_rating, tier,
// e ban_info da WABA. Persiste snapshot em meta_whatsapp_instances.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { idsInstanciasPermitidas, filtrarInstancias } from '../_shared/escopo-instancias.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string | undefined = body?.instancia_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let query = supabase.from('meta_whatsapp_instances').select('*').eq('ativo', true);
    if (instanciaId) query = query.eq('id', instanciaId);
    const { data: instanciasRaw, error } = await query;
    if (error) throw error;

    const permitidas = await idsInstanciasPermitidas(req, supabase);
    const instancias = filtrarInstancias(instanciasRaw as any[], permitidas);

    const results: any[] = [];
    for (const inst of instancias || []) {
      const r: any = {
        instancia_id: inst.id,
        nome: inst.nome,
        display_phone: inst.display_phone,
      };
      try {
        const fields = [
          'display_phone_number', 'verified_name', 'quality_rating',
          'name_status', 'code_verification_status', 'status',
          'throughput', 'messaging_limit_tier', 'platform_type', 'account_mode',
        ].join(',');
        const phoneResp = await fetchJson(
          `${GRAPH}/${inst.phone_number_id}?fields=${fields}`,
          inst.access_token,
        );
        if (!phoneResp.ok) {
          r.error = phoneResp.data?.error?.message || `HTTP ${phoneResp.status}`;
          r.raw = phoneResp.data;
        } else {
          r.status = phoneResp.data.status || null;
          r.quality_rating = phoneResp.data.quality_rating || null;
          r.messaging_limit_tier = phoneResp.data.messaging_limit_tier || null;
          r.name_status = phoneResp.data.name_status || null;
          r.throughput = phoneResp.data.throughput || null;
          r.account_mode = phoneResp.data.account_mode || null;
          r.platform_type = phoneResp.data.platform_type || null;
          r.raw = phoneResp.data;
        }

        if (inst.waba_id) {
          const wabaResp = await fetchJson(
            `${GRAPH}/${inst.waba_id}?fields=account_review_status,business_verification_status,ban_info,name,status`,
            inst.access_token,
          );
          if (wabaResp.ok) {
            r.waba = wabaResp.data;
            r.ban_info = wabaResp.data.ban_info || null;
          } else {
            r.waba_error = wabaResp.data?.error?.message || `HTTP ${wabaResp.status}`;
          }
        }

        const updatePayload: any = {
          saude_status: r.status,
          saude_quality: r.quality_rating,
          saude_tier: r.messaging_limit_tier,
          saude_name_status: r.name_status,
          saude_throughput: r.throughput,
          saude_ban_info: r.ban_info,
          saude_raw: { phone: r.raw, waba: r.waba || null },
          saude_checked_at: new Date().toISOString(),
          throughput_level: r.throughput?.level || null,
          meta_verified_name: r.raw?.verified_name || null,
          meta_name_status: r.name_status || null,
        };

        // Se a Graph API retornou tier, marca origem como meta_api
        // (só sobrescreve source se ainda não há override manual do usuário)
        if (r.messaging_limit_tier) {
          updatePayload.messaging_limit_synced_at = new Date().toISOString();
          if (!inst.messaging_limit_manual) {
            updatePayload.messaging_limit_source = 'meta_api';
          }
        }

        // ===== Auto-pausa por qualidade =====
        const qual = String(r.quality_rating || '').toUpperCase();
        const { data: cfg } = await supabase.from('meta_envio_pool_config').select('*').eq('id', 1).maybeSingle();
        const dur = (cfg?.duracao_pausa_yellow_horas ?? 48) * 3600 * 1000;

        let notificarPausa: { motivo: string; alcance: 'numero' | 'waba' } | null = null;

        const liberadaManual = inst.qualidade_liberada_manual === true;

        if (!liberadaManual && cfg?.auto_pausa_yellow !== false && qual === 'YELLOW' && !inst.pausa_automatica_ate) {
          updatePayload.pausa_automatica_ate = new Date(Date.now() + dur).toISOString();
          updatePayload.pausa_automatica_motivo = 'quality=YELLOW';
          updatePayload.estado_pool = 'pausado';
          notificarPausa = { motivo: `Qualidade caiu para YELLOW (pausado por ${cfg?.duracao_pausa_yellow_horas ?? 48}h)`, alcance: 'numero' };
        }
        if (!liberadaManual && cfg?.auto_pausa_red_waba !== false && qual === 'RED' && !inst.pausa_automatica_ate) {
          updatePayload.pausa_automatica_ate = new Date(Date.now() + dur * 2).toISOString();
          updatePayload.pausa_automatica_motivo = 'quality=RED';
          updatePayload.estado_pool = 'pausado';
          notificarPausa = { motivo: `Qualidade RED — número pausado + WABA em risco`, alcance: 'waba' };
          // Pausa WABA inteira
          if (inst.waba_id) {
            await supabase.from('meta_whatsapp_instances').update({
              pausa_automatica_ate: new Date(Date.now() + dur).toISOString(),
              pausa_automatica_motivo: 'quality=RED em irmão',
              estado_pool: 'pausado',
            }).eq('waba_id', inst.waba_id).neq('id', inst.id).is('pausa_automatica_ate', null);
          }
        }
        const st = String(r.status || '').toUpperCase();
        if ((st === 'FLAGGED' || st === 'RESTRICTED' || st === 'BANNED') && !inst.pausa_automatica_ate) {
          updatePayload.pausa_automatica_ate = new Date(Date.now() + dur * 3).toISOString();
          updatePayload.pausa_automatica_motivo = `status=${st}`;
          updatePayload.estado_pool = 'pausado';
          notificarPausa = { motivo: `Status Meta = ${st} — pausa preventiva`, alcance: 'numero' };
        }

        // ===== Quarentena por queda de qualidade =====
        // Número que cai para YELLOW/RED sai do pool de campanha por N dias e
        // volta com teto baixo (primeiro degrau da escada de retorno).
        const qualAnterior = String(inst.saude_quality || '').toUpperCase();
        const caiu = (qual === 'YELLOW' || qual === 'RED') && qualAnterior !== qual;
        const escada: number[] = Array.isArray(cfg?.escada_retorno) ? cfg.escada_retorno : [20, 40, 80];
        if (caiu && !liberadaManual) {
          const dias = Math.max(1, Number(cfg?.quarentena_dias ?? 7));
          const quarentenaAtual = inst.quarentena_ate ? new Date(inst.quarentena_ate).getTime() : 0;
          const novaQuarentena = Date.now() + dias * 86400000;
          if (novaQuarentena > quarentenaAtual) {
            updatePayload.quarentena_ate = new Date(novaQuarentena).toISOString();
            updatePayload.quarentena_motivo = `qualidade ${qual}`;
          }
          updatePayload.teto_escada = Number(escada[0] ?? 20);
        }
        // Alerta imediato de degradação (1 aviso por número por dia)
        let alertaQueda: string | null = null;
        if (caiu) {
          alertaQueda =
            `⚠️ *Qualidade caiu para ${qual}*\n\n` +
            `Número: *${inst.nome || inst.display_phone}*\n` +
            `Antes: ${qualAnterior || 'desconhecida'} → Agora: ${qual}\n` +
            (updatePayload.quarentena_ate
              ? `Quarentena até ${new Date(updatePayload.quarentena_ate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (fora das campanhas; segue atendendo conversas recebidas).\n`
              : '') +
            `Volta com teto de ${escada[0] ?? 20}/dia e sobe em escada se ficar GREEN.`;
        }

        await supabase.from('meta_whatsapp_instances').update(updatePayload).eq('id', inst.id);

        if (alertaQueda) {
          try {
            const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
            const { data: envio24h } = await supabase
              .from('meta_whatsapp_mensagens')
              .select('direcao')
              .eq('instancia_id', inst.id)
              .gte('criado_em', new Date(Date.now() - 86400000).toISOString())
              .limit(20000);
            const saidas = (envio24h || []).filter((m: any) => m.direcao === 'saida').length;
            const entradas = (envio24h || []).filter((m: any) => m.direcao === 'entrada').length;
            await notificarAdmin(supabase, {
              tipo: 'meta_queda_qualidade',
              mensagem: `${alertaQueda}\n\n📊 Últimas 24h: ${saidas} enviadas / ${entradas} recebidas`,
              chaveIdempotencia: `meta_queda_${inst.id}_${qual}_${new Date().toISOString().slice(0, 10)}`,
              umaVezPorChave: true,
            });
          } catch (e) {
            console.log('[health] alerta de queda falhou:', String(e).slice(0, 200));
          }
        }


        if (notificarPausa) {
          try {
            const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
            const chave = `meta_pausa_${inst.id}_${new Date().toISOString().slice(0,10)}`;
            await notificarAdmin(supabase, {
              tipo: 'meta_auto_pausa',
              mensagem:
                `🛑 Meta pausou número automaticamente\n\n` +
                `Número: *${inst.nome || inst.display_phone}*\n` +
                `Motivo: ${notificarPausa.motivo}\n` +
                (notificarPausa.alcance === 'waba' ? `⚠️ Toda a WABA foi pausada preventivamente.\n` : '') +
                `\nRetome manualmente em Monitor de Envios → Pool Meta quando quiser.`,
              chaveIdempotencia: chave,
            });
          } catch (e) {
            console.log('[health] notificarAdmin falhou:', String(e).slice(0, 200));
          }
        }
      } catch (e) {
        r.error = e instanceof Error ? e.message : String(e);
      }
      results.push(r);
    }


    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
