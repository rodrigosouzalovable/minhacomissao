// Vincula CPFs de um mailing (CSV "sufixo8,cpf") aos itens de campanha, contatos do Inbox
// e à base de vínculo telefone -> CPF. Usado para corrigir campanhas importadas sem a coluna de CPF.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function padDoc(raw: string): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length >= 5 && d.length <= 11) return d.padStart(11, '0');
  if (d.length >= 12 && d.length <= 14) return d.padStart(14, '0');
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { bucket, path, job_id } = await req.json().catch(() => ({} as any));
    if (!bucket || !path) {
      return new Response(JSON.stringify({ error: 'bucket e path são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
    if (dlErr) throw dlErr;
    const texto = await blob.text();

    const pares = new Map<string, string>();
    for (const linha of texto.split(/\r?\n/)) {
      if (!linha.trim()) continue;
      const [telRaw, cpfRaw] = linha.split(',');
      const tel = String(telRaw ?? '').replace(/\D/g, '');
      const cpf = padDoc(cpfRaw ?? '');
      if (tel.length < 8 || !cpf) continue;
      pares.set(tel.slice(-8), cpf);
    }
    if (pares.size === 0) {
      return new Response(JSON.stringify({ error: 'nenhum par telefone/CPF válido no arquivo' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Base de vínculo telefone -> CPF (usada pelo cabeçalho e pelos relatórios)
    const lista = [...pares.entries()].map(([telefone_sufixo, cpf]) => ({ telefone_sufixo, cpf, origem: 'mailing' }));
    let vinculos = 0;
    for (let i = 0; i < lista.length; i += 500) {
      const { error } = await supabase
        .from('acionamento_telefone_cpf')
        .upsert(lista.slice(i, i + 500), { onConflict: 'telefone_sufixo' });
      if (error) throw error;
      vinculos += Math.min(500, lista.length - i);
    }

    // 2) Itens da campanha sem CPF
    let itens = 0;
    if (job_id) {
      // PostgREST devolve no máximo 1000 linhas por requisição: pagina até o fim.
      const PAG = 1000;
      for (let offset = 0; ; offset += PAG) {
        const { data: rows, error } = await supabase
          .from('envio_meta_job_item')
          .select('id, telefone, cpf')
          .eq('job_id', job_id)
          .order('id', { ascending: true })
          .range(offset, offset + PAG - 1);
        if (error) throw error;
        for (const r of rows || []) {
          const atual = String((r as any).cpf ?? '').replace(/\D/g, '');
          if (atual.length === 11 || atual.length === 14) continue;
          const suf = String((r as any).telefone ?? '').replace(/\D/g, '').slice(-8);
          const cpf = pares.get(suf);
          if (!cpf) continue;
          await supabase.from('envio_meta_job_item').update({ cpf }).eq('id', (r as any).id);
          itens++;
        }
        if (!rows || rows.length < PAG) break;
      }
    }


    // 3) Contatos do Inbox sem CPF
    let contatos = 0;
    const sufixos = [...pares.keys()];
    for (let i = 0; i < sufixos.length; i += 20) {
      const bloco = sufixos.slice(i, i + 20);

      const filtro = bloco.map((s) => `telefone.like.*${s}`).join(',');
      const { data: rows, error } = await supabase
        .from('meta_whatsapp_contatos')
        .select('id, telefone, cpf')
        .or(filtro)
        .limit(5000);
      if (error) throw error;
      for (const r of rows || []) {
        const atual = String((r as any).cpf ?? '').replace(/\D/g, '');
        if (atual.length === 11 || atual.length === 14) continue;
        const suf = String((r as any).telefone ?? '').replace(/\D/g, '').slice(-8);
        const cpf = pares.get(suf);
        if (!cpf) continue;
        await supabase.from('meta_whatsapp_contatos')
          .update({ cpf, atualizado_em: new Date().toISOString() })
          .eq('id', (r as any).id);
        contatos++;
      }
    }

    return new Response(JSON.stringify({ success: true, pares: pares.size, vinculos, itens, contatos }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
