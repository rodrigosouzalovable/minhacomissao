// Verifica saúde das instâncias Meta WhatsApp via Graph API.
// Retorna status (CONNECTED/FLAGGED/RESTRICTED/etc), quality_rating, tier,
// e ban_info da WABA. Persiste snapshot em meta_whatsapp_instances.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { idsInstanciasPermitidas, filtrarInstancias } from '../_shared/escopo-instancias.ts';
import { linhaBmInstancia } from '../_shared/rotulo-instancia.ts';

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

          // Restrições de envio da WABA (ex.: RESTRICTED_BIZ_INITIATED_MESSAGING).
          // Chamada separada porque o campo não existe em todas as contas/versões —
          // um erro aqui não pode derrubar o restante do check.
          const restrResp = await fetchJson(
            `${GRAPH}/${inst.waba_id}?fields=health_status`,
            inst.access_token,
          );
          if (restrResp.ok) r.waba_health = restrResp.data?.health_status || null;
        }

        // Restrição no próprio número (health_status), também isolada.
        const phoneHealth = await fetchJson(
          `${GRAPH}/${inst.phone_number_id}?fields=health_status`,
          inst.access_token,
        );
        if (phoneHealth.ok) r.phone_health = phoneHealth.data?.health_status || null;

        // Restrição real de envio da Meta: can_send_message = BLOCKED/LIMITED
        // (na raiz ou em qualquer entidade: número, WABA, business, app).
        const restricoes: any = {
          phone_health: r.phone_health || null,
          waba_health: r.waba_health || null,
        };
        const RUIM = new Set(['BLOCKED', 'LIMITED', 'RESTRICTED']);
        const avaliaHealth = (h: any): boolean => {
          if (!h || typeof h !== 'object') return false;
          if (RUIM.has(String(h.can_send_message || '').toUpperCase())) return true;
          const ents = Array.isArray(h.entities) ? h.entities : [];
          return ents.some((e: any) => RUIM.has(String(e?.can_send_message || '').toUpperCase()));
        };
        const restritoMeta = avaliaHealth(r.phone_health) || avaliaHealth(r.waba_health);
        r.restrito_meta = restritoMeta;

        r.restricoes = restricoes;

        const updatePayload: any = {
          saude_status: r.status,
          saude_quality: r.quality_rating,
          saude_tier: r.messaging_limit_tier,
          saude_name_status: r.name_status,
          saude_throughput: r.throughput,
          saude_ban_info: r.ban_info,
          saude_restricoes: restricoes,
          saude_raw: { phone: r.raw, waba: r.waba || null, restricoes },
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

        // ===== Quarentena + recuperação automática por queda de qualidade =====
        // Número que cai para YELLOW/RED sai do pool de campanha por N dias,
        // entra em modo recuperação (aquecimento automático com os números UAZAPI
        // da pasta AQUECIMENTO) e volta com teto baixo (escada de retorno).
        const qualAnterior = String(inst.saude_quality || '').toUpperCase();
        const caiu = (qual === 'YELLOW' || qual === 'RED') && qualAnterior !== qual;
        const escada: number[] = Array.isArray(cfg?.escada_retorno) ? cfg.escada_retorno : [20, 40, 80];
        const recupAuto = cfg?.recuperacao_auto !== false;
        const msgsMin = Math.max(1, Number(cfg?.recuperacao_msgs_min_dia ?? 10));
        const msgsMax = Math.max(msgsMin, Number(cfg?.recuperacao_msgs_max_dia ?? 20));
        const msgsPiora = Math.max(1, Number(cfg?.recuperacao_msgs_dia_piora ?? 5));
        const diasGreenAlta = Math.max(1, Number(cfg?.recuperacao_dias_green_alta ?? 3));
        const hojeBrtDia = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
        ).toISOString().slice(0, 10);

        if (caiu && !liberadaManual) {
          const dias = Math.max(1, Number(cfg?.quarentena_dias ?? 7));
          const quarentenaAtual = inst.quarentena_ate ? new Date(inst.quarentena_ate).getTime() : 0;
          const novaQuarentena = Date.now() + dias * 86400000;
          if (novaQuarentena > quarentenaAtual) {
            updatePayload.quarentena_ate = new Date(novaQuarentena).toISOString();
            updatePayload.quarentena_motivo = `qualidade ${qual}`;
          }
          updatePayload.teto_escada = Number(escada[0] ?? 20);
          updatePayload.dias_green_consecutivos = 0;
          updatePayload.green_contado_dia = null;

          // Aquecimento automático só nos números próprios (parceiro Meta não usa).
          if (recupAuto && inst.aquecimento_qualidade_permitido !== false) {
            // Já estava em recuperação e piorou → reduz o volume em vez de subir.
            const piorou = inst.recuperacao_ativa === true;
            updatePayload.recuperacao_ativa = true;
            updatePayload.recuperacao_desde = inst.recuperacao_desde || new Date().toISOString();
            updatePayload.recuperacao_msgs_meta_dia = piorou
              ? msgsPiora
              : Math.floor(msgsMin + Math.random() * (msgsMax - msgsMin + 1));
            updatePayload.recuperacao_proximo_envio_em = new Date().toISOString();
          }
        }

        const { linhaPrevisao } = await import('../_shared/meta-recuperacao-aviso.ts');

        // ===== Volta para GREEN: conta os dias e encerra a recuperação =====
        let alertaRecuperado: string | null = null;
        let alertaProgressoGreen: { texto: string; dias: number } | null = null;
        if (qual === 'GREEN') {
          const contadoHoje = inst.green_contado_dia === hojeBrtDia;
          const diasGreen = contadoHoje
            ? Number(inst.dias_green_consecutivos || 0)
            : Number(inst.dias_green_consecutivos || 0) + 1;
          if (!contadoHoje) {
            updatePayload.dias_green_consecutivos = diasGreen;
            updatePayload.green_contado_dia = hojeBrtDia;
          }
          if (inst.recuperacao_ativa === true && diasGreen >= diasGreenAlta) {
            updatePayload.recuperacao_ativa = false;
            updatePayload.recuperacao_msgs_meta_dia = null;
            updatePayload.quarentena_ate = null;
            updatePayload.quarentena_motivo = null;
            updatePayload.estado_pool = 'ativo';
            alertaRecuperado =
              `✅ *Número recuperado — qualidade GREEN*\n\n` +
              `Número: *${inst.nome || inst.display_phone}*\n` +
              `${await linhaBmInstancia(supabase, inst)}\n` +
              `${diasGreen} dias seguidos em GREEN. Aquecimento automático encerrado; o número volta ao pool com teto de ${inst.teto_escada ?? escada[0] ?? 20}/dia e sobe em escada.`;
          } else if (inst.recuperacao_ativa === true && !contadoHoje) {
            // Voltou/segue em GREEN mas ainda não completou os dias necessários
            alertaProgressoGreen = {
              dias: diasGreen,
              texto:
                `🟢 *Qualidade em GREEN* (${diasGreen}/${diasGreenAlta} dias)\n\n` +
                `Número: *${inst.nome || inst.display_phone}*\n` +
                `${await linhaBmInstancia(supabase, inst)}\n` +
                (qualAnterior && qualAnterior !== 'GREEN'
                  ? `Subiu de ${qualAnterior} para GREEN — o aquecimento está funcionando.\n`
                  : `Mantendo GREEN com o aquecimento automático.\n`) +
                `O aquecimento continua até completar ${diasGreenAlta} dias seguidos.\n` +
                `${linhaPrevisao(qual, diasGreen, diasGreenAlta)}`,
            };
          }
        } else if (qual === 'YELLOW' || qual === 'RED') {
          updatePayload.dias_green_consecutivos = 0;
          updatePayload.green_contado_dia = null;
        }
        // Alerta imediato de degradação (1 aviso por número por dia)
        let alertaQueda: string | null = null;
        if (caiu) {
          const piorouEmRecup = inst.recuperacao_ativa === true;
          alertaQueda =
            `⚠️ *Qualidade caiu para ${qual}*\n\n` +
            `Número: *${inst.nome || inst.display_phone}*\n` +
            `${await linhaBmInstancia(supabase, inst)}\n` +
            `Antes: ${qualAnterior || 'desconhecida'} → Agora: ${qual}\n` +
            (piorouEmRecup
              ? `❗ Já estava em recuperação e piorou — volume do aquecimento reduzido para ${updatePayload.recuperacao_msgs_meta_dia}/dia. Sinal de bloqueio/denúncia real: vale revisar base e conteúdo.\n`
              : '') +
            (updatePayload.quarentena_ate
              ? `Quarentena até ${new Date(updatePayload.quarentena_ate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (fora das campanhas; segue atendendo conversas recebidas).\n`
              : '') +
            (updatePayload.recuperacao_ativa
              ? `🔥 Aquecimento automático ligado: ${updatePayload.recuperacao_msgs_meta_dia} mensagens/dia para os números UAZAPI da caixa AQUECIMENTO (09h–19h, intervalos de 20–40 min). Nada a fazer da sua parte.\n`
              : `ℹ️ Aquecimento automático não está liberado para este número.\n`) +
            `Volta com teto de ${escada[0] ?? 20}/dia e sobe em escada se ficar GREEN.\n` +
            `${linhaPrevisao(qual, 0, diasGreenAlta)}`;
        }



        // ===== Auto-liberação de bloqueio real da Meta =====
        // Só devolve o número ao pool quando está realmente saudável:
        // CONNECTED, sem ban_info, qualidade GREEN, sem quarentena ativa e sem
        // restrição de envio informada pela Meta. Se o bloqueio saiu mas a
        // qualidade continua YELLOW/RED (ou a conta segue restrita), o número
        // permanece fora das campanhas e em aquecimento automático.
        const { ehMotivoBloqueioMeta, ehMotivoPagamento } = await import('../_shared/meta-conta-bloqueada.ts');
        const motivoAtual = String(inst.pausa_automatica_motivo || '');
        const eraBloqueioMeta = ehMotivoBloqueioMeta(motivoAtual);
        const eraPagamento = ehMotivoPagamento(motivoAtual);
        const semBanAgora = !r.ban_info ||
          (typeof r.ban_info === 'object' && Object.keys(r.ban_info).length === 0);
        const graphOk = !r.error && st === 'CONNECTED' && semBanAgora;
        const quarentenaAlvo = updatePayload.quarentena_ate !== undefined
          ? updatePayload.quarentena_ate
          : inst.quarentena_ate;
        const quarentenaAtiva = !!quarentenaAlvo && new Date(quarentenaAlvo).getTime() > Date.now();
        const saudavel = qual === 'GREEN' && !quarentenaAtiva && !restritoMeta;

        if (eraBloqueioMeta && graphOk && !notificarPausa) {
          updatePayload.pausa_automatica_ate = null;
          updatePayload.pausa_automatica_motivo = null;
          if (saudavel) {
            updatePayload.estado_pool = 'ativo';
            r.liberada = true;
          } else {
            // Bloqueio saiu, mas o número não está apto: fica restrito.
            updatePayload.estado_pool = 'restrita';
            r.liberada_parcial = true;
          }
          r.liberada_pagamento = eraPagamento;
        }


        await supabase.from('meta_whatsapp_instances').update(updatePayload).eq('id', inst.id);

        if (r.liberada || r.liberada_parcial) {
          try {
            const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
            const bmLinha = await linhaBmInstancia(supabase, inst);
            const hojeBrt = new Date().toISOString().slice(0, 10);
            const causa = r.liberada_pagamento
              ? `A pendência de pagamento/elegibilidade da Business Manager foi regularizada — a Meta voltou a aceitar a conexão.`
              : `A Meta voltou a responder normalmente (CONNECTED, sem bloqueio de conta).`;
            const diasGreenAtual = Number(
              updatePayload.dias_green_consecutivos ?? inst.dias_green_consecutivos ?? 0,
            );
            const mensagem = r.liberada
              ? `✅ *Bloqueio da Meta liberado*\n\n` +
                `Número: *${inst.nome || inst.display_phone}*\n` +
                `${bmLinha}\n` +
                `${causa} Qualidade GREEN e sem restrição — o número voltou para o pool de envios.`
              : `⚠️ *Bloqueio da Meta liberado — número ainda NÃO liberado para campanhas*\n\n` +
                `Número: *${inst.nome || inst.display_phone}*\n` +
                `${bmLinha}\n` +
                `${causa}\n` +
                `Mas o número continua ${qual === 'GREEN' ? 'com pendência' : `com qualidade *${qual || 'desconhecida'}*`}` +
                (restritoMeta ? ` e *restrito pela Meta* (envio limitado no painel)` : '') +
                (quarentenaAtiva
                  ? ` e em quarentena até ${new Date(quarentenaAlvo).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                  : '') +
                `.\n` +
                `Segue fora das campanhas e em aquecimento automático — atende normalmente as conversas recebidas.\n` +
                `${linhaPrevisao(qual, diasGreenAtual, diasGreenAlta)}`;

            await notificarAdmin(supabase, {
              tipo: 'meta_bloqueio_liberado',
              mensagem,
              chaveIdempotencia: `meta_bloqueio_liberado_${inst.id}_${r.liberada ? 'ok' : 'parcial'}_${hojeBrt}`,
              umaVezPorChave: true,
            });
          } catch (e) {
            console.log('[health] aviso de liberação falhou:', String(e).slice(0, 200));
          }
        }


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

        if (alertaProgressoGreen) {
          try {
            const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
            await notificarAdmin(supabase, {
              tipo: 'meta_qualidade_progresso_green',
              mensagem: alertaProgressoGreen.texto,
              chaveIdempotencia: `meta_green_dia${alertaProgressoGreen.dias}_${inst.id}_${hojeBrtDia}`,
              umaVezPorChave: true,
            });
          } catch (e) {
            console.log('[health] aviso de progresso GREEN falhou:', String(e).slice(0, 200));
          }
        }

        if (alertaRecuperado) {
          try {
            const { notificarAdmin } = await import('../_shared/notificar-admin.ts');
            const { count: totalAquec } = await supabase
              .from('meta_recuperacao_log')
              .select('id', { count: 'exact', head: true })
              .eq('instancia_id', inst.id)
              .eq('status', 'enviado');
            await notificarAdmin(supabase, {
              tipo: 'meta_qualidade_recuperada',
              mensagem:
                `${alertaRecuperado}\n` +
                `📨 Total de mensagens de aquecimento enviadas por este número: ${totalAquec ?? 0}.`,
              chaveIdempotencia: `meta_recuperado_${inst.id}_${new Date().toISOString().slice(0, 10)}`,
              umaVezPorChave: true,
            });
          } catch (e) {
            console.log('[health] aviso de recuperação falhou:', String(e).slice(0, 200));
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
                `${await linhaBmInstancia(supabase, inst)}\n` +
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
