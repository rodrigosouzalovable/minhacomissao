// Rotina diária USA B2B: capta empresas de brasileiros na Flórida (Google Places, telefone +1),
// nunca repete número já contatado e cria a campanha Utility "confirmar_recebimento_de_mensagem"
// para 08:00 da Flórida (10:00 BRT), seg–sáb. Respostas caem na caixa USA B2B (IAGO vende).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCaller } from '../_shared/auth-guard.ts';
import { chavePodeBuscar, listarChavesGoogleMaps, marcarChaveIndisponivelNoMes } from '../_shared/google-maps-keys.ts';
import { semInstanciasSoLembrete } from '../_shared/instancias-so-lembrete.ts';

const DONO = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const PASTA_USA = '7b3e9a10-4c2d-4f8e-9a61-0d5e2c8b1a47';
const TEMPLATE = 'confirmar_recebimento_de_mensagem';
const CIDADES = ['Orlando FL', 'Kissimmee FL', 'Miami FL', 'Pompano Beach FL', 'Deerfield Beach FL', 'Boca Raton FL',
  'Fort Lauderdale FL', 'Tampa FL', 'Boston MA', 'Framingham MA', 'Newark NJ', 'Danbury CT', 'Atlanta GA', 'Houston TX'];
const NICHOS = ['brazilian hair salon', 'brazilian beauty salon', 'brazilian nail salon', 'brazilian eyelash extensions',
  'brazilian waxing', 'brazilian house cleaning', 'brazilian cleaning services', 'brazilian handyman', 'brazilian painting contractor',
  'brazilian construction', 'brazilian auto detailing', 'brazilian auto repair', 'brazilian bakery', 'brazilian restaurant',
  'brazilian market', 'açaí brazilian', 'brazilian moving company', 'brazilian landscaping'];
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function telUsa(p: any): string | null {
  const d = String(p.internationalPhoneNumber || '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin', scheduler: true, corsHeaders });
  if (caller instanceof Response) return caller;
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, key);
  const body = await req.json().catch(() => ({}));
  const { data: cfg } = await db.from('usa_b2b_config').select('*').eq('id', true).maybeSingle();
  if (!cfg?.ativo && body?.forcar !== true) return json({ success: true, pulado: 'rotina USA pausada' });
  // Meta: ~300 WhatsApp reais/dia. ~70% dos números do Maps são fixos (sem WhatsApp e sem cobrança), então envia 3x.
  const metaWhats = Math.min(1000, Math.max(1, Number(body?.limite) || cfg?.limite_dia || 300));
  const limite = Math.min(1500, metaWhats * 3);

  // Quando roda: agora (cron das 10h BRT) ou agendado para a próxima 10:00 BRT (preparo na véspera).
  const agora = new Date();
  let alvo = new Date(agora);
  if (body?.agendar_proximo === true) {
    alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 13, 0));
    if (alvo <= agora) alvo = new Date(alvo.getTime() + 86400_000);
  }
  const brt = new Date(alvo.getTime() - 3 * 3600_000);
  if (brt.getUTCDay() === 0) return json({ success: true, pulado: 'domingo' });
  const dia = brt.toISOString().slice(0, 10);
  const nomeCampanha = `USA B2B diário ${dia}`;
  const { data: ja } = await db.from('envio_meta_job').select('id').eq('user_id', DONO).eq('nome_campanha', nomeCampanha).limit(1);
  if (ja?.length && body?.forcar !== true) return json({ success: true, pulado: 'campanha do dia já criada', job_id: ja[0].id });

  // Números já contatados (qualquer campanha USA anterior) nunca recebem de novo.
  const vistos = new Set<string>();
  const { data: jobsUsa } = await db.from('envio_meta_job').select('id').eq('folder_id', PASTA_USA);
  for (const j of jobsUsa || []) {
    const { data: its } = await db.from('envio_meta_job_item').select('telefone').eq('job_id', j.id).limit(5000);
    for (const i of its || []) vistos.add(String(i.telefone).replace(/\D/g, '').slice(-10));
  }
  const { data: todos } = await db.from('usa_b2b_leads').select('telefone').limit(20000);
  for (const l of todos || []) vistos.add(l.telefone.slice(-10));

  // Estoque pendente; capta o que faltar.
  const { count: pend } = await db.from('usa_b2b_leads').select('id', { count: 'exact', head: true }).is('enviado_em', null);
  let faltam = limite - (pend || 0);
  let requisicoes = 0, captados = 0;
  if (faltam > 0) {
    const chaves = (await listarChavesGoogleMaps(db)).filter(chavePodeBuscar);
    const combos = CIDADES.flatMap((c) => NICHOS.map((n) => `${n} in ${c}`)).sort(() => Math.random() - 0.5);
    outer: for (const q of combos) {
      let token: string | undefined;
      for (let pg = 0; pg < 3; pg++) {
        if (faltam <= 0 || requisicoes >= 250 || !chaves.length) break outer;
        const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chaves[0].api_key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.internationalPhoneNumber,places.formattedAddress,places.websiteUri,nextPageToken' },
          body: JSON.stringify({ textQuery: q, languageCode: 'en', regionCode: 'US', pageSize: 20, ...(token ? { pageToken: token } : {}) }),
        });
        requisicoes++;
        if (r.status === 403 || r.status === 429) { await marcarChaveIndisponivelNoMes(db, chaves[0].id); chaves.shift(); continue; }
        if (!r.ok) break;
        const d = await r.json();
        const rows = [];
        for (const p of d.places || []) {
          const t = telUsa(p);
          if (!t || p.websiteUri || vistos.has(t.slice(-10))) continue; // só empresas SEM site
          vistos.add(t.slice(-10));
          rows.push({ telefone: t, nome: String(p.displayName?.text || '').slice(0, 120), place_id: p.id,
            cidade: q.split(' in ')[1], nicho: q.split(' in ')[0] });
        }
        if (rows.length) {
          const { error } = await db.from('usa_b2b_leads').upsert(rows, { onConflict: 'telefone', ignoreDuplicates: true });
          if (!error) { captados += rows.length; faltam -= rows.length; }
        }
        token = d.nextPageToken;
        if (!token) break;
      }
    }
  }

  const { data: leads } = await db.from('usa_b2b_leads').select('id,telefone,nome').is('enviado_em', null)
    .order('created_at').limit(limite);
  if (body?.simular === true) return json({ success: true, simulado: true, captados, requisicoes, prontos: leads?.length || 0 });
  if (!leads?.length) return json({ success: false, error: 'nenhum lead novo', captados, requisicoes }, 400);

  const { data: inst } = await db.from('meta_whatsapp_instances').select('id')
    .eq('user_id', DONO).eq('ativo', true).eq('saude_status', 'CONNECTED').eq('saude_quality', 'GREEN')
    .eq('estado_pool', 'ativo').eq('instancia_teste_aquecimento', false);
  const ids = semInstanciasSoLembrete((inst || []).map((i: any) => i.id));
  const { data: tpls } = await db.from('meta_whatsapp_templates').select('id,instancia_id')
    .in('instancia_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    .eq('nome_template', TEMPLATE).eq('status', 'approved').ilike('categoria', 'utility');
  const byInst: Record<string, string> = {};
  for (const t of tpls || []) byInst[t.instancia_id] = t.id;
  const nums = Object.keys(byInst).sort(() => Math.random() - 0.5).slice(0, 15);
  if (!nums.length) return json({ success: false, error: 'nenhum número GREEN com o modelo aprovado' }, 400);

  const clientes = leads.map((l) => {
    const nome = `pessoal da ${l.nome || 'empresa'}`.slice(0, 60);
    return { telefone: l.telefone, nome, vars: { '1': nome } };
  });
  const resp = await fetch(`${url}/functions/v1/envio-meta-massa-iniciar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      asUserId: DONO, template: { id: byInst[nums[0]], nome_template: TEMPLATE }, instanciaIds: nums,
      templateIdByInstance: Object.fromEntries(nums.map((n) => [n, byInst[n]])), clientes,
      minSec: 5, maxSec: 10, diasAntirrepeticao: 1, nomeCampanha, folderId: PASTA_USA, validar_no_envio: false,
      ...(body?.agendar_proximo === true ? { agendarPara: alvo.toISOString() } : {}),
    }),
  });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok || out?.success === false) return json({ success: false, error: out?.error || `HTTP ${resp.status}`, captados }, 500);
  await db.from('usa_b2b_leads').update({ enviado_em: new Date().toISOString(), job_id: out.job_id })
    .in('id', leads.map((l) => l.id));
  console.log('[usa-b2b-diario]', JSON.stringify({ captados, requisicoes, clientes: clientes.length, job: out.job_id, alvo }));
  return json({ success: true, job_id: out.job_id, clientes: clientes.length, captados, requisicoes, envio_em: alvo.toISOString(), numeros: nums.length });
});
