// Campanha B2B COBRANÇA: capta escritórios de cobrança do Brasil (Google Places, só celular +55)
// e cria a campanha Utility "confirmar_recebimento_de_mensagem" na caixa B2B COBRANÇA (IAGO vende mentoria/plataforma).
// Disparo manual (admin) — sem cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCaller } from '../_shared/auth-guard.ts';
import { chavePodeBuscar, listarChavesGoogleMaps, marcarChaveIndisponivelNoMes } from '../_shared/google-maps-keys.ts';
import { semInstanciasSoLembrete } from '../_shared/instancias-so-lembrete.ts';

const DONO = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
const PASTA = 'c0b2a7e1-5d3f-4a8b-9c11-2e6f8d4b7a90';
const TEMPLATE = 'confirmar_recebimento_de_mensagem';
const CIDADES = ['São Paulo SP', 'Rio de Janeiro RJ', 'Belo Horizonte MG', 'Curitiba PR', 'Porto Alegre RS', 'Goiânia GO', 'Brasília DF',
  'Salvador BA', 'Recife PE', 'Fortaleza CE', 'Campinas SP', 'Florianópolis SC', 'Manaus AM', 'Belém PA', 'Vitória ES', 'Ribeirão Preto SP',
  'Uberlândia MG', 'Londrina PR', 'Joinville SC', 'Campo Grande MS', 'Cuiabá MT', 'Natal RN', 'João Pessoa PB', 'São Luís MA', 'Maceió AL',
  'Santos SP', 'Sorocaba SP', 'Niterói RJ', 'Aracaju SE', 'Teresina PI', 'Anápolis GO', 'Maringá PR'];
const NICHOS = ['assessoria de cobrança', 'empresa de cobrança', 'recuperação de crédito', 'escritório de cobrança', 'cobrança extrajudicial', 'advocacia recuperação de crédito'];
const json = (p: unknown, s = 200) => new Response(JSON.stringify(p), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function telBr(p: any): string | null {
  const d = String(p.internationalPhoneNumber || p.nationalPhoneNumber || '').replace(/\D/g, '');
  const n = d.startsWith('55') ? d : `55${d.replace(/^0/, '')}`;
  return n.length === 13 && n[4] === '9' ? n : null; // somente celular (WhatsApp)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin', scheduler: true, corsHeaders });
  if (caller instanceof Response) return caller;
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, key);
  const body = await req.json().catch(() => ({}));
  // Meta: ~300 WhatsApp reais/dia. ~70% dos números do Maps são fixos (sem WhatsApp e sem cobrança), então envia 3x.
  const metaWhats = Math.min(1000, Math.max(1, Number(body?.limite) || 200));
  const limite = Math.min(1500, metaWhats);

  // Quando roda: agora (cron das 10h BRT) ou agendado para a próxima 10:00 BRT (preparo na véspera).
  const agora = new Date();
  let alvo = new Date(agora);
  if (body?.agendar_proximo === true) {
    alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 11, 0));
    if (alvo <= agora) alvo = new Date(alvo.getTime() + 86400_000);
  }
  const brt = new Date(alvo.getTime() - 3 * 3600_000);
  if (brt.getUTCDay() === 0) return json({ success: true, pulado: 'domingo' });
  const dia = brt.toISOString().slice(0, 10);
  const nomeCampanha = `B2B COBRANÇA ${dia}`;
  const { data: ja } = await db.from('envio_meta_job').select('id').eq('user_id', DONO).eq('nome_campanha', nomeCampanha).limit(1);
  if (ja?.length && body?.forcar !== true) return json({ success: true, pulado: 'campanha do dia já criada', job_id: ja[0].id });

  // Números já contatados (qualquer campanha USA anterior) nunca recebem de novo.
  const vistos = new Set<string>();
  const { data: jobsUsa } = await db.from('envio_meta_job').select('id').eq('folder_id', PASTA);
  for (const j of jobsUsa || []) {
    const { data: its } = await db.from('envio_meta_job_item').select('telefone').eq('job_id', j.id).limit(5000);
    for (const i of its || []) vistos.add(String(i.telefone).replace(/\D/g, '').slice(-8));
  }
  const { data: todos } = await db.from('cobranca_b2b_leads').select('telefone').limit(20000);
  for (const l of todos || []) vistos.add(l.telefone.slice(-8));

  // Estoque pendente; capta o que faltar.
  const { count: pend } = await db.from('cobranca_b2b_leads').select('id', { count: 'exact', head: true }).is('enviado_em', null);
  let faltam = limite - (pend || 0);
  let requisicoes = 0, captados = 0;
  if (faltam > 0) {
    const chaves = (await listarChavesGoogleMaps(db)).filter(chavePodeBuscar);
    const combos = CIDADES.flatMap((c) => NICHOS.map((n) => `${n} em ${c}`)).sort(() => Math.random() - 0.5);
    outer: for (const q of combos) {
      let token: string | undefined;
      for (let pg = 0; pg < 3; pg++) {
        if (faltam <= 0 || requisicoes >= 250 || !chaves.length) break outer;
        const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chaves[0].api_key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.internationalPhoneNumber,places.nationalPhoneNumber,places.formattedAddress,nextPageToken' },
          body: JSON.stringify({ textQuery: q, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20, ...(token ? { pageToken: token } : {}) }),
        });
        requisicoes++;
        if (r.status === 403 || r.status === 429) { await marcarChaveIndisponivelNoMes(db, chaves[0].id); chaves.shift(); continue; }
        if (!r.ok) break;
        const d = await r.json();
        const rows = [];
        for (const p of d.places || []) {
          const t = telBr(p);
          if (!t || vistos.has(t.slice(-8))) continue;
          vistos.add(t.slice(-8));
          rows.push({ telefone: t, nome: String(p.displayName?.text || '').slice(0, 120), place_id: p.id,
            cidade: q.split(' em ')[1], nicho: q.split(' em ')[0] });
        }
        if (rows.length) {
          const { error } = await db.from('cobranca_b2b_leads').upsert(rows, { onConflict: 'telefone', ignoreDuplicates: true });
          if (!error) { captados += rows.length; faltam -= rows.length; }
        }
        token = d.nextPageToken;
        if (!token) break;
      }
    }
  }

  const { data: leads } = await db.from('cobranca_b2b_leads').select('id,telefone,nome').is('enviado_em', null)
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
    const nome = `pessoal da ${l.nome || 'equipe'}`.slice(0, 60);
    return { telefone: l.telefone, nome, vars: { '1': nome } };
  });
  const resp = await fetch(`${url}/functions/v1/envio-meta-massa-iniciar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      asUserId: DONO, template: { id: byInst[nums[0]], nome_template: TEMPLATE }, instanciaIds: nums,
      templateIdByInstance: Object.fromEntries(nums.map((n) => [n, byInst[n]])), clientes,
      minSec: 5, maxSec: 10, diasAntirrepeticao: 1, nomeCampanha, folderId: PASTA, validar_no_envio: false,
      ...(body?.agendar_proximo === true ? { agendarPara: alvo.toISOString() } : {}),
    }),
  });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok || out?.success === false) return json({ success: false, error: out?.error || `HTTP ${resp.status}`, captados }, 500);
  await db.from('cobranca_b2b_leads').update({ enviado_em: new Date().toISOString(), job_id: out.job_id })
    .in('id', leads.map((l) => l.id));
  console.log('[cobranca-b2b-campanha]', JSON.stringify({ captados, requisicoes, clientes: clientes.length, job: out.job_id, alvo }));
  return json({ success: true, job_id: out.job_id, clientes: clientes.length, captados, requisicoes, envio_em: alvo.toISOString(), numeros: nums.length });
});
