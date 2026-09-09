// Valida se números têm WhatsApp usando TODAS as instâncias UAZAPI conectadas.
// Distribui os lotes em paralelo entre as instâncias conectadas, o que permite
// validar listas grandes (milhares) sem depender de um único número.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
);

const BATCH_SIZE = 15;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;

function formatPhone(phone: string): string {
  const clean = String(phone || '').replace(/\D/g, '');
  return clean.startsWith('55') ? clean : `55${clean}`;
}

type Inst = { id: string; nome: string; server_url: string; instance_token: string };

async function estaConectada(inst: Inst): Promise<boolean> {
  const base = inst.server_url.replace(/\/+$/, '');
  for (const url of [`${base}/instance/status`, `${base}/status`]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12_000);
      const r = await fetch(url, { headers: { token: inst.instance_token }, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const txt = await r.text();
      let d: any; try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
      const s = JSON.stringify(d?.instance ?? d ?? {}).toLowerCase();
      if (/"(status|state|connectionstatus)"\s*:\s*"(connected|open|conectado)"/.test(s) || /loggedin"\s*:\s*true/.test(s)) return true;
    } catch { /* tenta próximo endpoint */ }
  }
  return false;
}

async function checkBatch(inst: Inst, batch: string[]): Promise<any[] | null> {
  const base = inst.server_url.replace(/\/+$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(`${base}/chat/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: inst.instance_token },
      body: JSON.stringify({ numbers: batch }),
      signal: ctrl.signal,
    });
    const txt = await r.text();
    let d: any; try { d = JSON.parse(txt); } catch { return null; }
    if (d?.code === 504 || d?.message === 'Request timeout') return null;
    if (!r.ok) return null;
    const arr = Array.isArray(d) ? d : Array.isArray(d?.numbers) ? d.numbers : Array.isArray(d?.result) ? d.result : null;
    return arr;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { numbers } = await req.json();
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return json({ error: 'numbers array é obrigatório' }, 400);
    }

    const { data: instRows, error: instErr } = await supabase
      .from('user_whatsapp_instances')
      .select('id, nome, server_url, instance_token')
      .eq('ativo', true)
      .order('nome');
    if (instErr) return json({ error: instErr.message }, 500);

    const candidatas = (instRows || []).filter((i: any) => i.server_url && i.instance_token) as Inst[];
    if (candidatas.length === 0) {
      return json({ error: 'Nenhuma instância UAZAPI cadastrada', valid: [], invalid: [], errors: numbers, sem_validadores: true });
    }

    // Checa conexão em paralelo (lotes de 5)
    const conectadas: Inst[] = [];
    for (let i = 0; i < candidatas.length; i += 5) {
      const slice = candidatas.slice(i, i + 5);
      const res = await Promise.all(slice.map(async (inst) => ({ inst, ok: await estaConectada(inst) })));
      res.forEach((r) => { if (r.ok) conectadas.push(r.inst); });
    }
    if (conectadas.length === 0) {
      return json({ error: 'Nenhuma instância UAZAPI conectada no momento', valid: [], invalid: [], errors: numbers, sem_validadores: true });
    }

    const formatted = numbers.map((n: string) => formatPhone(n));
    type B = { batch: string[]; original: string[]; index: number };
    const batches: B[] = [];
    for (let i = 0; i < formatted.length; i += BATCH_SIZE) {
      batches.push({ batch: formatted.slice(i, i + BATCH_SIZE), original: numbers.slice(i, i + BATCH_SIZE), index: batches.length + 1 });
    }

    const valid: string[] = [];
    const invalid: string[] = [];
    const errors: string[] = [];

    // Uma "worker" por instância conectada, consumindo a fila de lotes.
    let cursor = 0;
    const worker = async (inst: Inst) => {
      while (true) {
        const b = batches[cursor++];
        if (!b) return;
        let arr: any[] | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES && !arr; attempt++) {
          arr = await checkBatch(inst, b.batch);
          if (!arr && attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 1200));
        }
        if (!arr) {
          b.original.forEach((n) => errors.push(n));
          continue;
        }
        arr.forEach((item: any, idx: number) => {
          const has = item?.isInWhatsapp === true || item?.exists === true || item?.numberExists === true || item?.onWhatsapp === true;
          const original = b.original[idx] ?? b.batch[idx];
          (has ? valid : invalid).push(original);
        });
      }
    };

    await Promise.all(conectadas.map((inst) => worker(inst)));

    console.log(`[uazapi-validar] instancias=${conectadas.length} total=${numbers.length} valid=${valid.length} invalid=${invalid.length} errors=${errors.length}`);

    return json({
      valid, invalid, errors,
      total: numbers.length,
      total_valid: valid.length,
      total_invalid: invalid.length,
      total_errors: errors.length,
      instancias_usadas: conectadas.map((i) => i.nome),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro desconhecido' }, 500);
  }
});
