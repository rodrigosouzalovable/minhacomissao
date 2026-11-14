// Campanha diária automática da carteira SFTP (UME + Odres Cred), seg–sáb às 08:00 BRT.
// Chamada pela rotina process-campanha-meta-diaria (mesmo agendamento, sem cron novo).
// Seleção: clientes novos primeiro, depois maior score (atraso recente + valor), sem acordo ativo,
// sem blacklist/supressão e sem campanha recente (UME 7 dias, Odres 5). Duas campanhas em paralelo,
// uma por credor, com números separados: cada cliente recebe só o modelo Utility do seu credor.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCaller } from '../_shared/auth-guard.ts';
import { textoOferta } from '../_shared/oferta-carteira.ts';
import { dividirNumeros } from '../_shared/carteira-divisao.ts';

const DONO = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const INICIO = '2026-11-14';
const NOME = 'Carteira SFTP auto';
const TEMPLATES = { ume: 'acesse_o_portal_de_negociacao', odres_cred: 'odres_portal_de_negociacao' } as const;
const LIMITE = { ume: 3000, odres_cred: 4000 };
// Dias sem repetir por credor. Odres em 5 dias para preencher o lote (com 7 dias a base livre não chega a 4.000).
const DIAS_FADIGA = { ume: 7, odres_cred: 5 };

const json = (p: unknown, status = 200) =>
  new Response(JSON.stringify(p), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const agoraBRT = () => new Date(Date.now() - 3 * 3600_000);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin', corsHeaders });
  if (caller instanceof Response) return caller;
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, key);
  const body = await req.json().catch(() => ({}));
  const simular = body?.simular === true;
  // Complemento: completa o lote de hoje até o limite por credor (ex.: lote saiu menor).
  const complemento = body?.complemento === true;

  const brt = agoraBRT();
  const hoje = brt.toISOString().slice(0, 10);
  const prefixo = `${NOME} ${hoje}`;
  const sufixo = complemento ? ' complemento' : '';
  if (!simular) {
    if (hoje < INICIO) return json({ success: true, pulado: `começa em ${INICIO}` });
    if (brt.getUTCDay() === 0) return json({ success: true, pulado: 'domingo' });
    if (!complemento) {
      const { data: ja } = await db.from('envio_meta_job').select('id').eq('user_id', DONO)
        .in('nome_campanha', [prefixo, `${prefixo} UME`, `${prefixo} Odres`]).limit(1);
      if (ja?.length) return json({ success: true, pulado: 'campanha de hoje já criada', job_id: ja[0].id });
    }
  }

  // Complemento: desconta o que as campanhas de hoje já incluíram, por credor.
  const jaHoje = { ume: 0, odres_cred: 0 };
  if (complemento) {
    const { data: jh } = await db.from('envio_meta_job').select('id').eq('user_id', DONO)
      .ilike('nome_campanha', `${prefixo}%`);
    for (const cr of ['ume', 'odres_cred'] as const) {
      for (const j of jh || []) {
        const { count } = await db.from('envio_meta_job_item').select('id', { count: 'exact', head: true })
          .eq('job_id', j.id).eq('credor', cr);
        jaHoje[cr] += count || 0;
      }
    }
  }

  // Resultado único em JSON: a consulta por linhas era cortada em 1.000 pela API (500 por credor).
  const { data: cand, error } = await db.rpc('carteira_sftp_candidatos_json', {
    p_dias_ume: DIAS_FADIGA.ume, p_dias_odres: DIAS_FADIGA.odres_cred,
    p_limite_ume: Math.max(0, LIMITE.ume - jaHoje.ume), p_limite_odres: Math.max(0, LIMITE.odres_cred - jaHoje.odres_cred),
  });
  if (error) return json({ success: false, error: error.message }, 500);
  const lista = (Array.isArray(cand) ? cand : []) as Array<{ cpf: string; nome: string; telefone: string; credor: 'ume' | 'odres_cred'; avista: number; atraso: number; novo: boolean; score: number }>;
  const mes = brt.getUTCMonth() + 1;
  const clientes = lista.map((c) => {
    const p = String(c.nome || 'cliente').trim().split(/\s+/)[0] || 'cliente';
    const nome = p[0].toUpperCase() + p.slice(1).toLowerCase();
    return { telefone: c.telefone, nome, cpf: c.cpf, credor: c.credor, saldo: Number(c.avista),
      atraso: String(c.atraso ?? ''), vars: { '1': nome, '2': textoOferta(c.credor, Number(c.avista), mes) } };
  });
  const resumo = {
    ume: lista.filter((c) => c.credor === 'ume').length,
    odres_cred: lista.filter((c) => c.credor === 'odres_cred').length,
    novos: lista.filter((c) => c.novo).length,
  };
  if (simular) return json({ success: true, simulado: true, resumo, amostra: clientes.slice(0, 5).map((c) => ({ ...c, telefone: `***${c.telefone.slice(-4)}`, cpf: undefined })) });
  if (!clientes.length) return json({ success: true, clientes: 0, resumo });

  // Números GREEN do pool com os dois modelos Utility aprovados (nunca o modelo do outro credor).
  const { data: inst } = await db.from('meta_whatsapp_instances').select('id')
    .eq('user_id', DONO).eq('ativo', true).eq('saude_status', 'CONNECTED').eq('saude_quality', 'GREEN')
    .eq('estado_pool', 'ativo').eq('instancia_teste_aquecimento', false);
  const ids = (inst || []).map((i: any) => i.id);
  const { data: tpls } = await db.from('meta_whatsapp_templates').select('id,instancia_id,nome_template')
    .in('instancia_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    .in('nome_template', Object.values(TEMPLATES)).eq('status', 'approved').ilike('categoria', 'utility');
  const por: Record<string, Record<string, string>> = { ume: {}, odres_cred: {} };
  for (const t of tpls || []) {
    if (t.nome_template === TEMPLATES.ume) por.ume[t.instancia_id] = t.id;
    if (t.nome_template === TEMPLATES.odres_cred) por.odres_cred[t.instancia_id] = t.id;
  }
  const instIds = Object.keys(por.ume).filter((id) => por.odres_cred[id]);
  if (!instIds.length) return json({ success: false, error: 'nenhum número GREEN com os dois modelos Utility', resumo }, 400);

  // Mesma caixa do Inbox usada na última campanha manual da carteira.
  const { data: ult } = await db.from('envio_meta_job').select('folder_id').eq('user_id', DONO)
    .in('template_nome', Object.values(TEMPLATES)).not('nome_campanha', 'ilike', `${NOME}%`)
    .order('created_at', { ascending: false }).limit(1);

  // Uma campanha por credor, cada uma com seus próprios números (sem repetir número entre elas):
  // correm em paralelo, dobrando a vazão sem dois envios disputarem o mesmo número.
  const divisao = dividirNumeros(instIds, resumo.ume, resumo.odres_cred);
  const resultados: Record<string, unknown> = {};
  let ok = true;
  for (const cr of ['ume', 'odres_cred'] as const) {
    const cli = clientes.filter((c) => c.credor === cr);
    const nums = divisao[cr];
    if (!cli.length || !nums.length) continue;
    const byInst = Object.fromEntries(nums.map((id) => [id, por[cr][id]]));
    const resp = await fetch(`${url}/functions/v1/envio-meta-massa-iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        asUserId: DONO, template: { id: byInst[nums[0]], nome_template: TEMPLATES[cr] },
        instanciaIds: nums, templateIdByInstance: byInst,
        templateVariantes: [{ credor: cr, nome_template: TEMPLATES[cr], template_id: byInst[nums[0]], template_id_by_instance: byInst }],
        clientes: cli, minSec: 2, maxSec: 4, diasAntirrepeticao: Math.min(DIAS_FADIGA.ume, DIAS_FADIGA.odres_cred),
        nomeCampanha: `${prefixo}${sufixo} ${cr === 'ume' ? 'UME' : 'Odres'}`, folderId: ult?.[0]?.folder_id ?? null,
      }),
    });
    const out = await resp.json().catch(() => ({}));
    ok = ok && resp.ok && out?.success !== false;
    resultados[cr] = { numeros: nums.length, clientes: cli.length, job_id: out?.job_id, erro: out?.error };
  }
  console.log('[carteira-sftp-auto]', JSON.stringify({ resumo, numeros: instIds.length, resultados }));
  return json({ success: ok, clientes: clientes.length, resumo, numeros: instIds.length, resultados }, ok ? 200 : 500);
});
