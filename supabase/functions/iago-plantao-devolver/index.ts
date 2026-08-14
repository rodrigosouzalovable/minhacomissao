// Devolve ao atendente humano original as conversas que o IAGO assumiu no plantão.
// Roda pela manhã (08:05 BRT): fora da janela do plantão, a etiqueta original volta.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CAIXA_PADRAO_ID = '00000000-0000-0000-0000-000000000000';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function toMin(v: unknown) {
  const [h, m] = String(v || '00:00').split(':');
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function plantaoAtivoAgora(janela: any) {
  if (!janela?.ativo) return false;
  const agoraSP = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const minutos = agoraSP.getUTCHours() * 60 + agoraSP.getUTCMinutes();
  const dia = agoraSP.getUTCDay();
  const ini = toMin(janela.hora_inicio);
  const fim = toMin(janela.hora_fim);
  const naJanela = ini === fim
    ? true
    : (ini < fim ? (minutos >= ini && minutos < fim) : (minutos >= ini || minutos < fim));
  const fds24h = janela.fim_semana_24h !== false && (dia === 0 || dia === 6);
  return naJanela || fds24h;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: pendentes } = await supabase
      .from('iago_plantao_transferencia')
      .select('contato_id, etiqueta_original_id, folder_id')
      .is('devolvido_em', null)
      .limit(500);

    if (!pendentes?.length) return json({ success: true, devolvidas: 0 });

    // Janelas por caixa (evita uma consulta por conversa)
    const { data: janelas } = await supabase
      .from('meta_inbox_folder_iago_janela')
      .select('folder_id, ativo, hora_inicio, hora_fim, fim_semana_24h');
    const janelaPorFolder = new Map<string, any>(
      (janelas || []).map((j: any) => [String(j.folder_id), j]),
    );

    // Etiqueta do IAGO
    const { data: cfg } = await supabase.from('iago_config').select('user_id').limit(1).maybeSingle();
    let nomeIago = '';
    if ((cfg as any)?.user_id) {
      const { data: p } = await supabase
        .from('profiles').select('nome').eq('id', (cfg as any).user_id).maybeSingle();
      nomeIago = String((p as any)?.nome || '').trim().toLowerCase();
    }
    if (!nomeIago) nomeIago = 'iago';
    const { data: etiquetas } = await supabase
      .from('meta_whatsapp_etiquetas')
      .select('id, nome')
      .ilike('nome', 'Atendente:%');
    const idsIago = (etiquetas || [])
      .filter((e: any) => {
        const n = String(e.nome || '').replace(/^atendente:\s*/i, '').trim().toLowerCase();
        return n === nomeIago || n.startsWith('iago');
      })
      .map((e: any) => e.id);

    let devolvidas = 0;
    for (const t of pendentes as any[]) {
      const janela = janelaPorFolder.get(String(t.folder_id ?? CAIXA_PADRAO_ID));
      if (plantaoAtivoAgora(janela)) continue; // ainda no plantão: mantém com o IAGO

      if (idsIago.length) {
        await supabase
          .from('meta_whatsapp_contato_etiquetas')
          .delete()
          .eq('contato_id', t.contato_id)
          .in('etiqueta_id', idsIago);
      }

      const { error: insErr } = await supabase
        .from('meta_whatsapp_contato_etiquetas')
        .insert({
          contato_id: t.contato_id,
          etiqueta_id: t.etiqueta_original_id,
          origem: 'plantao_iago_devolucao',
        } as any);
      if (insErr) {
        const dup = String(insErr.message || '').toLowerCase().includes('duplicate') || (insErr as any).code === '23505';
        if (!dup) {
          console.error('[IagoPlantao] falha ao devolver etiqueta', { contato_id: t.contato_id, erro: insErr.message });
          continue;
        }
      }

      await supabase
        .from('iago_plantao_transferencia')
        .update({ devolvido_em: new Date().toISOString() })
        .eq('contato_id', t.contato_id);
      devolvidas++;
    }

    console.log('[IagoPlantao] devolução concluída', { pendentes: pendentes.length, devolvidas });
    return json({ success: true, pendentes: pendentes.length, devolvidas });
  } catch (e: any) {
    console.error('[IagoPlantao] erro', e?.message || e);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});
