// Envia lembretes de boletos (D-3 e D0) via API oficial Meta.
// Chamado 1x/dia pelo cron às 08:30 BRT. Toggle ativo/inativo em meta_lembrete_config.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sb() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
function nowBRT() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function formatBR(d: string) { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; }
function rnd(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function normalizePhone(raw: string) {
  const d = (raw||'').replace(/\D/g,'');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
}

async function invokeSendMeta(supabase: any, instancia_id: string, cliente: any, template: any) {
  return await supabase.functions.invoke('send-whatsapp-meta', {
    body: { instancia_id, cliente, template, template_id: template?.id },
  });
}

async function notifyAdmin(supabase: any, telefones: string[], mensagem: string, fallbackInstanceId: string | null) {
  if (!fallbackInstanceId || telefones.length === 0) return;
  const { data: inst } = await supabase
    .from('meta_whatsapp_instances')
    .select('id, phone_number_id, access_token, ativo, saude_quality')
    .eq('ativo', true)
    .neq('saude_quality', 'RED')
    .neq('saude_quality', 'YELLOW')
    .limit(1)
    .maybeSingle();
  const target = inst?.id || fallbackInstanceId;
  if (!target) return;
  for (const tel of telefones) {
    const to = normalizePhone(tel);
    if (!to) continue;
    try {
      await supabase.functions.invoke('send-whatsapp-meta-text', {
        body: { instancia_id: target, telefone: to, texto: mensagem },
      });
    } catch (_) { /* silent */ }
    await sleep(rnd(2000, 4000));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const dryRun: boolean = body?.dryRun === true;
    const force: boolean = body?.force === true;

    const supabase = sb();

    const { data: cfg } = await supabase
      .from('meta_lembrete_config')
      .select('*')
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cfg) {
      return new Response(JSON.stringify({ ok: false, error: 'Configuração não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    if (!cfg.ativo && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: 'inativo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const brt = nowBRT();
    if (brt.getDay() === 0 && !force) {
      return new Response(JSON.stringify({ ok: true, skipped: 'domingo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const instanciaIds: string[] = Array.isArray(cfg.instancia_ids) ? cfg.instancia_ids : [];
    if (instanciaIds.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'nenhuma instância configurada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Instâncias saudáveis
    const { data: instRows } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, saude_quality, ativo, estado_pool, pausa_automatica_ate')
      .in('id', instanciaIds);
    const now = Date.now();
    const instAtivas = (instRows || []).filter((i: any) => {
      if (!i.ativo) return false;
      const q = String(i.saude_quality || '').toUpperCase();
      if (q === 'RED' || q === 'YELLOW') return false;
      if (i.pausa_automatica_ate && new Date(i.pausa_automatica_ate).getTime() > now) return false;
      return true;
    });
    if (instAtivas.length === 0) {
      await notifyAdmin(supabase, cfg.notificar_telefones || [],
        `⚠️ Lembrete Meta ${isoDate(brt)}: nenhuma instância saudável para enviar. Verifique a saúde/pool das instâncias selecionadas.`,
        instanciaIds[0]);
      return new Response(JSON.stringify({ ok: false, error: 'sem instâncias saudáveis' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Template FIXO — buscamos por nome + instância no round-robin
    const TEMPLATE_NOME = 'lembrete_envio_boleto';
    const { data: tplsAprovados } = await supabase
      .from('meta_whatsapp_templates')
      .select('id, nome_template, idioma, categoria, status, body_text, instancia_id, meta_template_name, header_type, header_text, footer_text, botoes, variaveis')
      .eq('nome_template', TEMPLATE_NOME)
      .eq('status', 'approved')
      .in('instancia_id', instanciaIds);
    const tplPorInstancia = new Map<string, any>();
    for (const t of tplsAprovados || []) tplPorInstancia.set(t.instancia_id, t);

    if (tplPorInstancia.size === 0) {
      await notifyAdmin(supabase, cfg.notificar_telefones || [],
        `⚠️ Lembrete Meta ${isoDate(brt)}: nenhuma instância selecionada tem o template "${TEMPLATE_NOME}" aprovado.`,
        instanciaIds[0]);
      return new Response(JSON.stringify({ ok: false, error: 'template não aprovado em nenhuma instância' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    // Datas alvo — D-3 e D0 sempre
    const hoje = isoDate(brt);
    const em3 = new Date(brt); em3.setDate(em3.getDate() + 3);
    const dataD3 = isoDate(em3);
    const targets: Array<{ tipo: 'D-3'|'D0'; dataRef: string }> = [
      { tipo: 'D-3', dataRef: dataD3 },
      { tipo: 'D0', dataRef: hoje },
    ];

    // Marca execução
    await supabase.from('meta_lembrete_config').update({ ultima_execucao: new Date().toISOString() })
      .eq('id', cfg.id);

    let totalEnviado = 0, totalFalha = 0, totalPulado = 0;
    const instRoundRobin = [...instAtivas];
    const instBloqueadas = new Set<string>();
    let rrIdx = 0;

    for (const t of targets) {
      // Pagamentos alvo
      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select('id, acordo_id, numero_parcela, data_prevista, valor_parcela, acordos!inner(id, user_id, cliente_nome, cliente_cpf, cliente_telefone, status)')
        .eq('status', 'pendente')
        .eq('data_prevista', t.dataRef)
        .eq('acordos.status', 'ativo');

      const items = (pagamentos as any[]) || [];

      for (const p of items) {
        const acordo = p.acordos;
        const telRaw = acordo?.cliente_telefone;
        if (!telRaw) { totalPulado++; continue; }
        const telefone = normalizePhone(String(telRaw));
        if (!telefone) { totalPulado++; continue; }

        // Dedup
        const { data: exist } = await supabase.from('meta_lembrete_log')
          .select('id').eq('pagamento_id', p.id).eq('tipo', t.tipo).eq('data_ref', hoje).maybeSingle();
        if (exist) { totalPulado++; continue; }

        // Round-robin: instância saudável, não bloqueada, E com o template aprovado
        let chosen: any = null;
        let template: any = null;
        for (let i = 0; i < instRoundRobin.length; i++) {
          const cand = instRoundRobin[(rrIdx + i) % instRoundRobin.length];
          if (instBloqueadas.has(cand.id)) continue;
          const tpl = tplPorInstancia.get(cand.id);
          if (!tpl) continue;
          chosen = cand; template = tpl;
          rrIdx = (rrIdx + i + 1) % instRoundRobin.length;
          break;
        }
        if (!chosen) {
          totalPulado++;
          continue;
        }

        // Vars fixas: {{1}} = nome, {{2}} = data de vencimento
        const nome = String(acordo?.cliente_nome || '').trim() || 'cliente';
        const cpf = String(acordo?.cliente_cpf || '');
        const dataVenc = formatBR(p.data_prevista);
        const valor = Number(p.valor_parcela || 0);
        const vars: Record<string, string> = { '1': nome, '2': dataVenc };

        if (dryRun) {
          totalEnviado++;
          console.log(`[DRY] ${t.tipo} ${telefone} inst=${chosen.nome}`, vars);
          continue;
        }

        try {
          const { data: resp, error: sendErr } = await invokeSendMeta(supabase, chosen.id,
            { telefone, nome, cpf, saldo: valor, vars }, template);

          const success = !sendErr && resp?.success !== false && !resp?.error;
          const waId = resp?.waId || null;
          const errTxt = sendErr ? String(sendErr.message || sendErr) : (resp?.error || null);

          await supabase.from('meta_lembrete_log').insert({
            pagamento_id: p.id, acordo_id: p.acordo_id, user_id: acordo?.user_id,
            tipo: t.tipo, data_ref: hoje,
            instancia_id: chosen.id, instancia_nome: chosen.nome,
            telefone, sucesso: success, erro: errTxt, wa_message_id: waId,
          });

          if (success) { totalEnviado++; }
          else {
            totalFalha++;
            // Auto-bloqueia instância no lote atual e notifica
            instBloqueadas.add(chosen.id);
            await notifyAdmin(supabase, cfg.notificar_telefones || [],
              `❌ Lembrete Meta — falha ao enviar\n\nInstância: ${chosen.nome}\nCliente: ${nome}\nTel: ${telefone}\nTipo: ${t.tipo}\n\nErro: ${errTxt || 'desconhecido'}`,
              instanciaIds[0]);
          }
        } catch (e) {
          totalFalha++;
          const err = e instanceof Error ? e.message : String(e);
          await supabase.from('meta_lembrete_log').insert({
            pagamento_id: p.id, acordo_id: p.acordo_id, user_id: acordo?.user_id,
            tipo: t.tipo, data_ref: hoje,
            instancia_id: chosen.id, instancia_nome: chosen.nome,
            telefone, sucesso: false, erro: err,
          });
          instBloqueadas.add(chosen.id);
          await notifyAdmin(supabase, cfg.notificar_telefones || [],
            `❌ Lembrete Meta — exceção\n\nInstância: ${chosen.nome}\nTel: ${telefone}\nErro: ${err}`,
            instanciaIds[0]);
        }

        // delay randômico
        await sleep(rnd(Math.max(1, cfg.min_seg) * 1000, Math.max(cfg.min_seg, cfg.max_seg) * 1000));

        // Se todas as instâncias bloquearam, para
        if (instBloqueadas.size >= instAtivas.length) {
          await notifyAdmin(supabase, cfg.notificar_telefones || [],
            `⚠️ Lembrete Meta: todas as instâncias apresentaram erro. Job interrompido.`,
            instanciaIds[0]);
          break;
        }
      }
    }

    // Resumo final
    const usadas = instAtivas.filter(i => !instBloqueadas.has(i.id)).length;
    await notifyAdmin(supabase, cfg.notificar_telefones || [],
      `✅ Lembrete Meta concluído (${isoDate(brt)})\n\n📤 Enviados: ${totalEnviado}\n❌ Falhas: ${totalFalha}\n⏭️ Pulados: ${totalPulado}\n📱 Instâncias ativas no lote: ${usadas}/${instAtivas.length}`,
      instanciaIds[0]);

    return new Response(JSON.stringify({
      ok: true, enviados: totalEnviado, falhas: totalFalha, pulados: totalPulado,
      instancias_bloqueadas: Array.from(instBloqueadas),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});
