// Campanha diária automática da carteira SFTP (UME + Odres Cred), seg–sáb às 08:00 BRT.
// Chamada pela rotina process-campanha-meta-diaria (mesmo agendamento, sem cron novo).
// Seleção: clientes novos primeiro, depois maior score (atraso recente + valor), sem acordo ativo,
// sem blacklist/supressão e sem campanha nos últimos 7 dias. Uma campanha única multi-credor:
// cada cliente recebe só o modelo Utility do seu credor.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCaller } from '../_shared/auth-guard.ts';
import { textoOferta } from '../_shared/oferta-carteira.ts';

const DONO = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const INICIO = '2026-11-16';
const NOME = 'Carteira SFTP auto';
const TEMPLATES = { ume: 'acesse_o_portal_de_negociacao', odres_cred: 'odres_portal_de_negociacao' } as const;
const LIMITE = { ume: 3000, odres_cred: 4000 };
const DIAS_FADIGA = 7;

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

  const brt = agoraBRT();
  const hoje = brt.toISOString().slice(0, 10);
  if (!simular) {
    if (hoje < INICIO) return json({ success: true, pulado: `começa em ${INICIO}` });
    if (brt.getUTCDay() === 0) return json({ success: true, pulado: 'domingo' });
    const { data: ja } = await db.from('envio_meta_job').select('id').eq('user_id', DONO)
      .eq('nome_campanha', `${NOME} ${hoje}`).limit(1);
    if (ja?.length) return json({ success: true, pulado: 'campanha de hoje já criada', job_id: ja[0].id });
  }

  const { data: cand, error } = await db.rpc('carteira_sftp_candidatos', {
    p_dias_fadiga: DIAS_FADIGA, p_limite_ume: LIMITE.ume, p_limite_odres: LIMITE.odres_cred,
  });
  if (error) return json({ success: false, error: error.message }, 500);
  const lista = (cand || []) as Array<{ cpf: string; nome: string; telefone: string; credor: 'ume' | 'odres_cred'; avista: number; atraso: number; novo: boolean; score: number }>;
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
  const so = (m: Record<string, string>) => Object.fromEntries(instIds.map((id) => [id, m[id]]));
  const variantes = (['ume', 'odres_cred'] as const).map((cr) => ({
    credor: cr, nome_template: TEMPLATES[cr], template_id: por[cr][instIds[0]], template_id_by_instance: so(por[cr]),
  }));

  // Mesma caixa do Inbox usada na última campanha manual da carteira.
  const { data: ult } = await db.from('envio_meta_job').select('folder_id').eq('user_id', DONO)
    .in('template_nome', Object.values(TEMPLATES)).not('nome_campanha', 'ilike', `${NOME}%`)
    .order('created_at', { ascending: false }).limit(1);

  const resp = await fetch(`${url}/functions/v1/envio-meta-massa-iniciar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      asUserId: DONO, template: { id: variantes[1].template_id, nome_template: TEMPLATES.odres_cred },
      instanciaIds: instIds, templateIdByInstance: variantes[1].template_id_by_instance, templateVariantes: variantes,
      clientes, minSec: 2, maxSec: 4, diasAntirrepeticao: DIAS_FADIGA,
      nomeCampanha: `${NOME} ${hoje}`, folderId: ult?.[0]?.folder_id ?? null,
    }),
  });
  const out = await resp.json().catch(() => ({}));
  console.log('[carteira-sftp-auto]', JSON.stringify({ resumo, numeros: instIds.length, ok: resp.ok, job: out?.job_id, erro: out?.error }));
  return json({ success: resp.ok && out?.success !== false, clientes: clientes.length, resumo, numeros: instIds.length, resultado: out }, resp.ok ? 200 : 500);
});
