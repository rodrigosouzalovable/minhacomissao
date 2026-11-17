import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCaller } from '../_shared/auth-guard.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Chave salva pela tela fica em bucket privado (só service role lê); nunca volta ao navegador.
const BUCKET = 'config-privada';
const ARQ = 'creatomate/api-key.txt';
const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
async function lerChave(): Promise<string | null> {
  const { data } = await db().storage.from(BUCKET).download(ARQ);
  const t = data ? (await data.text()).trim() : '';
  return t || Deno.env.get('CREATOMATE_API_KEY') || null;
}
async function testar(k: string) {
  const r = await fetch('https://api.creatomate.com/v2/templates', { headers: { Authorization: `Bearer ${k}` } });
  return r.ok;
}

const API = 'https://api.creatomate.com/v2/renders';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const isUrl = (u: unknown) => typeof u === 'string' && /^https:\/\/\S+$/.test(u) && u.length < 2000;
const isSocial = (u: string) => /^https:\/\/([\w-]+\.)?(tiktok\.com|vm\.tiktok\.com)\//i.test(u);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Links de página do TikTok viram .mp4 sem marca d'água, copiado para armazenamento próprio (a Creatomate não lê o CDN do TikTok).
async function resolverLink(u: string): Promise<string> {
  if (!isSocial(u)) return u;
  // O extrator gratuito aceita 1 pedido/segundo: chamadas são sequenciais e repetem ao bater no limite.
  let d: any = null;
  for (let t = 0; t < 4; t++) {
    if (t) await sleep(1300 * t);
    const r = await fetch(`https://www.tikwm.com/api/?hd=1&url=${encodeURIComponent(u)}`).catch(() => null);
    d = await r?.json().catch(() => null);
    if (d?.data?.hdplay || d?.data?.play) break;
  }
  const mp4 = d?.data?.hdplay || d?.data?.play;
  if (!mp4) throw new Error(`Não consegui extrair o vídeo (o vídeo pode ser privado ou removido): ${u}`);
  const v = await fetch(mp4);
  if (!v.ok) throw new Error(`Falha ao baixar o vídeo: ${u}`);
  const buf = await v.arrayBuffer();
  if (buf.byteLength > 150 * 1024 * 1024) throw new Error('Vídeo grande demais (máx. 150 MB)');
  const c = db();
  await c.storage.createBucket('fabrica-videos-clipes', { public: true }).catch(() => {});
  const path = `${d.data.id || crypto.randomUUID()}.mp4`;
  const { error } = await c.storage.from('fabrica-videos-clipes').upload(path, new Blob([buf], { type: 'video/mp4' }), { upsert: true, contentType: 'video/mp4' });
  if (error) throw new Error('Falha ao guardar o vídeo extraído');
  return c.storage.from('fabrica-videos-clipes').getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin', corsHeaders });
  if (caller instanceof Response) return caller;
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  if (body?.acao === 'salvar_chave') {
    const k = typeof body.chave === 'string' ? body.chave.trim() : '';
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(k)) return json({ error: 'Chave em formato inválido' }, 400);
    if (!(await testar(k))) return json({ error: 'A Creatomate recusou essa chave. Copie novamente em Project Settings.' }, 400);
    const c = db();
    await c.storage.createBucket(BUCKET, { public: false }).catch(() => {});
    const { error } = await c.storage.from(BUCKET).upload(ARQ, new Blob([k], { type: 'text/plain' }), { upsert: true });
    if (error) return json({ error: 'Falha ao salvar a chave' }, 500);
    return json({ ok: true });
  }

  const key = await lerChave();
  if (body?.acao === 'status_chave') return json({ configurada: !!key, valida: key ? await testar(key) : false });
  if (!key) return json({ error: 'Chave da Creatomate não configurada' }, 400);
  const auth = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  if (body?.acao === 'status') {
    if (typeof body.id !== 'string' || !/^[\w-]{8,64}$/.test(body.id)) return json({ error: 'id inválido' }, 400);
    const r = await fetch(`${API}/${body.id}`, { headers: auth });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: d?.message || `Creatomate ${r.status}` }, 502);
    return json({ id: d.id, status: d.status, url: d.url, erro: d.error_message });
  }

  const brutos: string[] = Array.isArray(body?.links) ? [...new Set<string>(body.links.filter(isUrl))].slice(0, 10) : [];
  if (!brutos.length) return json({ error: 'Informe ao menos um link https de vídeo (.mp4 ou TikTok)' }, 400);
  let links: string[];
  try {
    links = [];
    for (const [i, u] of brutos.entries()) {
      if (i && isSocial(u)) await sleep(1100);
      links.push(await resolverLink(u));
    }
  } catch (e) { return json({ error: (e as Error).message }, 400); }
  const narracao = typeof body.narracao === 'string' ? body.narracao.trim().slice(0, 2000) : '';
  const gancho = typeof body.gancho === 'string' ? body.gancho.trim().slice(0, 120) : '';
  const voz = typeof body.voz === 'string' && body.voz.length < 200 ? body.voz : 'elevenlabs model_id=eleven_multilingual_v2 voice_id=21m00Tcm4TlvDq8ikWAM';
  const templateId = typeof body.template_id === 'string' && /^[\w-]{8,64}$/.test(body.template_id) ? body.template_id : null;

  let payload: any;
  if (templateId) {
    payload = { template_id: templateId, modifications: { 'Background-Video': links[0], 'Primary-Text': gancho || narracao } };
  } else {
    const clipes = links.map((src) => ({ type: 'video', track: 1, source: src, fit: 'cover', volume: narracao ? '0%' : '100%', ...(narracao ? { duration: null } : {}) }));
    const elements: any[] = [...clipes];
    if (narracao) elements.push({ type: 'audio', name: 'Voz', track: 2, time: 0, source: narracao, provider: voz });
    elements.push({
      type: 'text', track: 3, time: 0, width: '86%', height: '30%', y: '72%',
      transcript_source: narracao ? 'Voz' : 'Video-1', transcript_effect: 'highlight', transcript_maximum_length: 14,
      font_family: 'Montserrat', font_weight: '800', font_size: '8 vmin', fill_color: '#ffffff',
      stroke_color: '#000000', stroke_width: '1.6 vmin', transcript_color: '#ffd400', x_alignment: '50%', y_alignment: '50%',
    });
    if (!narracao) elements[0].name = 'Video-1';
    if (gancho) elements.push({ type: 'text', track: 4, time: 0, duration: 3, y: '18%', width: '86%', text: gancho, font_family: 'Montserrat', font_weight: '900', font_size: '9 vmin', fill_color: '#ffffff', background_color: 'rgba(0,0,0,0.6)', background_x_padding: '20%', background_y_padding: '20%' });
    payload = { output_format: 'mp4', width: 1080, height: 1920, elements };
  }

  const r = await fetch(API, { method: 'POST', headers: auth, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: d?.message || d?.hint || `Creatomate ${r.status}` }, 502);
  const render = Array.isArray(d) ? d[0] : d;
  return json({ id: render.id, status: render.status, url: render.url });
});
