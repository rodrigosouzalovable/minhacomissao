// Planejamento diário do aquecimento inteligente (cron 07:00 BRT).
// Para cada número Meta saudável define, com apoio da IA, o alvo de
// destinatários ÚNICOS do dia e o mix entre destinos UAZAPI e leads reais.
// Sem loop, sem auto-invocação: 1 execução por dia, 1 chamada de IA.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hojeBrt } from '../_shared/meta-aquecimento-alvo.ts';
import { carregarOrcamento, proximoTier, tierAtual } from '../_shared/meta-aquecimento-inteligente.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIMITE_INSTANCIAS = 40;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Alvo determinístico, usado como base e como fallback quando a IA falha. */
function alvoBase(tier: number, diasGreen: number, unicos7d: number): number {
  const meta7d = proximoTier(tier) * 0.5; // volume que costuma destravar o próximo tier
  const faltam = Math.max(0, meta7d - unicos7d);
  const porDia = Math.ceil(faltam / 7);
  const tetoSeguro = Math.min(
    Math.round(tier * 0.6),
    diasGreen >= 3 ? Math.round(tier * 0.6) : Math.max(20, Math.round(tier * 0.15)),
  );
  return Math.max(10, Math.min(porDia || 20, tetoSeguro));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const dia = hojeBrt();
    const body = await req.json().catch(() => ({}));
    const forcar = body?.forcar === true;

    // Single-flight: se já existe plano do dia, não replaneja.
    const { count: jaFeitos } = await supabase
      .from('meta_aquecimento_trilha')
      .select('id', { count: 'exact', head: true })
      .eq('dia', dia);
    if ((jaFeitos ?? 0) > 0 && !forcar) {
      return json({ ok: true, skipped: 'plano_do_dia_existente', dia });
    }

    const orc = await carregarOrcamento(supabase, dia);

    const { data: insts } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, display_phone, saude_quality, saude_tier, tier_diario, dias_green_consecutivos, estado_pool, recuperacao_ativa, quarentena_ate, pausa_automatica_ate, ativo, provider, phone_number_id, access_token, data_ativacao_api')
      .eq('ativo', true)
      .eq('provider', 'meta')
      .eq('aquecimento_meta_ativo', true)
      .limit(200);

    const elegiveis = (insts || []).filter((i: any) => {
      if (i.recuperacao_ativa === true) return false;
      if (i.estado_pool && i.estado_pool !== 'ativo') return false;
      if (i.quarentena_ate && new Date(i.quarentena_ate) > new Date()) return false;
      if (i.pausa_automatica_ate && new Date(i.pausa_automatica_ate) > new Date()) return false;
      if (!i.phone_number_id || !i.access_token) return false;
      const q = String(i.saude_quality || 'UNKNOWN').toUpperCase();
      return q === 'GREEN' || q === 'UNKNOWN';
    }).slice(0, LIMITE_INSTANCIAS);

    if ((insts || []).length === 0) return json({ ok: true, skipped: 'nenhuma_selecionada', dia });
    if (elegiveis.length === 0) return json({ ok: true, skipped: 'nenhuma_elegivel', dia });

    const desde = new Date(Date.now() - 7 * 86400000).toISOString();

    // Únicos dos últimos 7 dias por instância (campanhas + aquecimento).
    const { data: envios } = await supabase
      .from('meta_whatsapp_envios_log')
      .select('instancia_id, telefone, status')
      .gte('enviado_em', desde)
      .limit(20000);
    const { data: logsAq } = await supabase
      .from('meta_aquecimento_destino_log')
      .select('instancia_id, destino_telefone, status, respondeu_em')
      .gte('enviado_em', desde)
      .limit(20000);

    const unicos = new Map<string, Set<string>>();
    const add = (inst: string | null, tel: string | null) => {
      if (!inst || !tel) return;
      const s = unicos.get(inst) || new Set<string>();
      s.add(String(tel).replace(/\D/g, '').slice(-8));
      unicos.set(inst, s);
    };
    for (const e of (envios || []) as any[]) {
      if (String(e.status || '').toLowerCase() === 'falha') continue;
      add(e.instancia_id, e.telefone);
    }
    for (const l of (logsAq || []) as any[]) {
      if (l.status === 'falha') continue;
      add(l.instancia_id, l.destino_telefone);
    }

    const respostas = new Map<string, { env: number; resp: number }>();
    for (const l of (logsAq || []) as any[]) {
      if (!l.instancia_id || l.status === 'falha') continue;
      const r = respostas.get(l.instancia_id) || { env: 0, resp: 0 };
      r.env++;
      if (l.respondeu_em) r.resp++;
      respostas.set(l.instancia_id, r);
    }

    const resumo = elegiveis.map((i: any) => {
      const tier = tierAtual(i);
      const u7 = unicos.get(i.id)?.size ?? 0;
      const r = respostas.get(i.id) || { env: 0, resp: 0 };
      return {
        id: i.id,
        nome: i.nome || i.display_phone,
        qualidade: String(i.saude_quality || 'UNKNOWN').toUpperCase(),
        tier_atual: tier,
        tier_alvo: proximoTier(tier),
        dias_green: Number(i.dias_green_consecutivos || 0),
        unicos_7d: u7,
        taxa_resposta: r.env > 0 ? Math.round((r.resp / r.env) * 100) : null,
        alvo_base: alvoBase(tier, Number(i.dias_green_consecutivos || 0), u7),
      };
    });

    // ===== Decisão da IA (1 chamada) =====
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let decisoes: Record<string, { alvo: number; mix_uazapi: number; observacao?: string }> = {};
    let iaErro: string | null = null;

    if (LOVABLE_API_KEY) {
      try {
        const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-3.7-flash',
            messages: [
              {
                role: 'system',
                content: `Você planeja o aquecimento de números WhatsApp na API oficial da Meta para subir de tier (250 → 1k → 10k → 100k).
A Meta promove o tier quando o número mantém qualidade alta e atinge um volume alto de destinatários ÚNICOS numa janela de 7 dias (aproximadamente metade do próximo tier).
Regras obrigatórias:
- Nunca ultrapasse 60% do tier atual em um único dia.
- Números com menos de 3 dias em GREEN devem crescer devagar (no máximo ~15% do tier por dia).
- Qualidade UNKNOWN é tratada como número novo: comece baixo.
- mix_uazapi é a porcentagem (0-100) de disparos para números próprios de aquecimento (resposta garantida); o resto vai para leads reais que costumam responder. Números novos ou com pouca resposta devem ter mix_uazapi alto (70-100). Números estáveis podem baixar para 40-60 para ganhar diversidade de destinatários reais.
- O orçamento diário total é de R$ ${orc.teto_reais} para TODOS os números somados; seja realista.
Responda apenas pela ferramenta.`,
              },
              {
                role: 'user',
                content: `Orçamento do dia: R$ ${orc.teto_reais} (custo médio por mensagem: R$ ${orc.custo_utility} utility / R$ ${orc.custo_marketing} marketing).
Números:\n${JSON.stringify(resumo, null, 1)}`,
              },
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'plano_aquecimento',
                description: 'Plano diário por número',
                parameters: {
                  type: 'object',
                  properties: {
                    numeros: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          alvo_unicos_dia: { type: 'number' },
                          mix_uazapi_pct: { type: 'number' },
                          observacao: { type: 'string' },
                        },
                        required: ['id', 'alvo_unicos_dia', 'mix_uazapi_pct'],
                      },
                    },
                  },
                  required: ['numeros'],
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'plano_aquecimento' } },
          }),
        });

        if (!resp.ok) {
          iaErro = `IA ${resp.status}`;
          console.log('[planejar] IA falhou', resp.status, (await resp.text()).slice(0, 300));
        } else {
          const jsonResp = await resp.json();
          const args = jsonResp?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          const parsed = args ? JSON.parse(args) : null;
          for (const n of parsed?.numeros || []) {
            decisoes[String(n.id)] = {
              alvo: Number(n.alvo_unicos_dia) || 0,
              mix_uazapi: Math.max(0, Math.min(100, Number(n.mix_uazapi_pct) || 60)),
              observacao: n.observacao || undefined,
            };
          }
        }
      } catch (e) {
        iaErro = String(e).slice(0, 200);
      }
    } else {
      iaErro = 'LOVABLE_API_KEY ausente';
    }

    const linhas = resumo.map((r) => {
      const d = decisoes[r.id];
      const tetoDuro = Math.max(10, Math.round(r.tier_atual * 0.6));
      const alvo = Math.max(5, Math.min(d?.alvo || r.alvo_base, tetoDuro));
      const mixU = d ? d.mix_uazapi : (r.taxa_resposta === null ? 80 : 60);
      return {
        instancia_id: r.id,
        dia,
        tier_atual: r.tier_atual,
        tier_alvo: r.tier_alvo,
        alvo_unicos_dia: alvo,
        unicos_7d: r.unicos_7d,
        mix_uazapi_pct: mixU,
        mix_leads_pct: 100 - mixU,
        decisao_ia: { fonte: d ? 'ia' : 'regra', observacao: d?.observacao ?? iaErro, base: r },
        status: 'ativa',
        atualizado_em: new Date().toISOString(),
      };
    });

    // Trilhas anteriores (para detectar quem está entrando no aquecimento agora)
    const { data: anteriores } = await supabase
      .from('meta_aquecimento_trilha')
      .select('instancia_id')
      .lt('dia', dia)
      .in('instancia_id', linhas.map((l) => l.instancia_id));
    const jaAquecidos = new Set(((anteriores as any[]) ?? []).map((a) => a.instancia_id));

    const { error } = await supabase
      .from('meta_aquecimento_trilha')
      .upsert(linhas, { onConflict: 'instancia_id,dia' });
    if (error) throw error;

    // Aviso de início do aquecimento (uma vez por número)
    const novos = linhas.filter((l) => !jaAquecidos.has(l.instancia_id));
    for (const l of novos) {
      const r = resumo.find((x) => x.id === l.instancia_id);
      const msg = [
        '🔥 *Aquecimento iniciado*',
        `${r?.nome ?? l.instancia_id}`,
        `Tier atual: ${l.tier_atual.toLocaleString('pt-BR')}/dia → alvo: ${l.tier_alvo.toLocaleString('pt-BR')}/dia`,
        `Meta de hoje: ${l.alvo_unicos_dia} destinatários únicos (${l.mix_uazapi_pct}% UAZAPI / ${l.mix_leads_pct}% leads)`,
      ].join('\n');
      try {
        await notificarNumeros(supabase, {
          tipo: 'aquecimento_tier_inicio',
          mensagem: msg,
          destinatarios: DESTINATARIOS_AVISO,
          chaveIdempotencia: `aq-tier-inicio-${l.instancia_id}`,
        });
      } catch (e) {
        console.log('[planejar] falha ao avisar início', String(e).slice(0, 200));
      }
    }

    return json({ ok: true, dia, planejadas: linhas.length, avisos_inicio: novos.length, ia: iaErro ? `fallback: ${iaErro}` : 'ok', linhas });

  } catch (e) {
    console.error('[meta-aquecimento-planejar]', e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
