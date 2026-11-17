import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCaller } from '../_shared/auth-guard.ts';

const API = 'https://api.creatomate.com/v2/renders';
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const isUrl = (u: unknown) => typeof u === 'string' && /^https:\/\/\S+$/.test(u) && u.length < 2000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const caller = await requireCaller(req, { user: 'admin', corsHeaders });
  if (caller instanceof Response) return caller;
  const key = Deno.env.get('CREATOMATE_API_KEY');
  if (!key) return json({ error: 'Chave da Creatomate não configurada' }, 400);
  const auth = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  if (body?.acao === 'status') {
    if (typeof body.id !== 'string' || !/^[\w-]{8,64}$/.test(body.id)) return json({ error: 'id inválido' }, 400);
    const r = await fetch(`${API}/${body.id}`, { headers: auth });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: d?.message || `Creatomate ${r.status}` }, 502);
    return json({ id: d.id, status: d.status, url: d.url, erro: d.error_message });
  }

  const links: string[] = Array.isArray(body?.links) ? body.links.filter(isUrl).slice(0, 10) : [];
  if (!links.length) return json({ error: 'Informe ao menos um link https de vídeo (.mp4)' }, 400);
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
