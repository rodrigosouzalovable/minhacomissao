import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type Registro = {
  tipo: 'A' | 'TXT';
  nome: string;
  esperado: string;
  encontrado: string[];
  ok: boolean;
};

const DOH_ENDPOINTS = [
  (name: string, type: string) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  (name: string, type: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
];

const HOSTNAME_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

async function resolveDns(name: string, type: 'A' | 'TXT'): Promise<string[]> {
  let lastError: unknown = null;
  for (const build of DOH_ENDPOINTS) {
    try {
      const res = await fetch(build(name, type), { headers: { accept: 'application/dns-json' } });
      if (!res.ok) {
        await res.text();
        lastError = new Error(`DNS HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const answers: Array<{ type: number; data: string }> = json?.Answer ?? [];
      const wanted = type === 'A' ? 1 : 16;
      return answers
        .filter((a) => a.type === wanted)
        .map((a) => String(a.data ?? '').replace(/^"|"$/g, '').replace(/"\s+"/g, ''))
        .filter(Boolean);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) console.error('dns-check resolve falhou', name, type, lastError);
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const hostname = String(body?.hostname ?? '').trim().toLowerCase();
    const aEsperado = String(body?.a_esperado ?? '185.158.133.1').trim();
    const txtLovable = String(body?.txt_lovable ?? '').trim();
    const txtMeta = String(body?.txt_meta ?? '').trim();

    if (!hostname || !HOSTNAME_RE.test(hostname)) {
      return new Response(JSON.stringify({ error: 'hostname inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const registros: Registro[] = [];

    const aEncontrado = await resolveDns(hostname, 'A');
    registros.push({
      tipo: 'A',
      nome: hostname,
      esperado: aEsperado,
      encontrado: aEncontrado,
      ok: aEncontrado.includes(aEsperado),
    });

    if (txtLovable) {
      const nome = `_lovable.${hostname}`;
      const encontrado = await resolveDns(nome, 'TXT');
      registros.push({
        tipo: 'TXT',
        nome,
        esperado: txtLovable,
        encontrado,
        ok: encontrado.some((v) => v.trim() === txtLovable),
      });
    }

    if (txtMeta) {
      const encontrado = await resolveDns(hostname, 'TXT');
      registros.push({
        tipo: 'TXT',
        nome: hostname,
        esperado: txtMeta,
        encontrado,
        ok: encontrado.some((v) => v.trim() === txtMeta),
      });
    }

    const todosOk = registros.length > 0 && registros.every((r) => r.ok);

    return new Response(JSON.stringify({ hostname, registros, todosOk, verificadoEm: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('dns-check erro', error);
    return new Response(JSON.stringify({ error: 'Falha ao consultar DNS' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
