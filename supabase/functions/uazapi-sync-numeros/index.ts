// Sincroniza o número real (telefone) de cada instância UAZAPI da aba Acionamento
// e propaga para a instância espelho do Inbox Meta (display_phone).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function extrairTelefone(data: any): string | null {
  const cands = [
    data?.instance?.owner, data?.instance?.wid, data?.instance?.jid,
    data?.owner, data?.wid, data?.jid, data?.phone, data?.number,
    data?.instance?.phoneConnected, data?.instance?.profileName,
  ];
  for (const c of cands) {
    const d = String(c ?? '').replace(/\D/g, '');
    if (d.length >= 12 && d.length <= 15) return d.startsWith('55') ? d : `55${d}`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let folderId: string | null = null;
    try { folderId = (await req.json())?.folder_id ?? null; } catch { /* sem body */ }

    // Espelhos da caixa (ou todos, se não vier folder)
    let q = supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, display_phone, uazapi_instance_id')
      .eq('provider', 'uazapi')
      .not('uazapi_instance_id', 'is', null);
    if (folderId) q = q.eq('folder_padrao_id', folderId);
    const { data: espelhos, error: e1 } = await q;
    if (e1) throw e1;

    const ids = (espelhos || []).map((e: any) => e.uazapi_instance_id);
    if (!ids.length) return json({ ok: true, atualizados: 0, total: 0 });

    const { data: instancias, error: e2 } = await supabase
      .from('user_whatsapp_instances')
      .select('id, nome, telefone, server_url, instance_token')
      .in('id', ids);
    if (e2) throw e2;

    const porId = new Map((instancias || []).map((i: any) => [i.id, i]));
    let atualizados = 0;
    const detalhes: any[] = [];

    for (const esp of espelhos || []) {
      const inst: any = porId.get((esp as any).uazapi_instance_id);
      if (!inst) continue;

      let telefone: string | null = inst.telefone ? String(inst.telefone).replace(/\D/g, '') : null;

      if (inst.server_url && inst.instance_token) {
        const base = String(inst.server_url).replace(/\/+$/, '');
        for (const url of [`${base}/instance/status`, `${base}/status`]) {
          try {
            const r = await fetch(url, { headers: { token: inst.instance_token, 'Content-Type': 'application/json' } });
            if (!r.ok) continue;
            const d = await r.json().catch(() => null);
            const t = extrairTelefone(d);
            if (t) { telefone = t; break; }
          } catch { /* tenta o próximo */ }
        }
      }

      if (!telefone) { detalhes.push({ nome: inst.nome, telefone: null }); continue; }

      if (telefone !== String(inst.telefone || '')) {
        await supabase.from('user_whatsapp_instances').update({ telefone }).eq('id', inst.id);
      }
      if (telefone !== String((esp as any).display_phone || '')) {
        await supabase.from('meta_whatsapp_instances').update({ display_phone: telefone }).eq('id', (esp as any).id);
        atualizados++;
      }
      detalhes.push({ nome: inst.nome, telefone });
    }

    return json({ ok: true, total: (espelhos || []).length, atualizados, detalhes });
  } catch (e) {
    console.error('uazapi-sync-numeros erro:', e);
    return json({ error: e instanceof Error ? e.message : 'Erro desconhecido' }, 500);
  }
});
