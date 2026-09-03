// Aprendizado diário do aquecimento (cron 21:00 BRT).
// Recalcula o score de cada nicho a partir do log real de disparos, bane nichos
// que geram reclamação e repõe o estoque de leads buscando no Google Maps
// apenas os nichos campeões. Uma execução por dia, sem loop.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hojeBrt } from '../_shared/meta-aquecimento-alvo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESTOQUE_MINIMO = 120;
const MAX_BUSCAS_POR_RUN = 2;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const dia = hojeBrt();
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: logs } = await supabase
      .from('meta_aquecimento_destino_log')
      .select('fonte, nicho, cidade, status, respondeu_em, segundos_para_resposta, erro')
      .eq('fonte', 'lead')
      .gte('enviado_em', desde)
      .limit(20000);

    type Agg = { envios: number; respostas: number; rapidas: number; reclamacoes: number };
    const agg = new Map<string, Agg>();
    const chave = (n: string, c: string) => `${n.toLowerCase()}||${c.toLowerCase()}`;

    for (const l of (logs || []) as any[]) {
      const nicho = String(l.nicho || '').trim();
      if (!nicho) continue;
      const cidade = String(l.cidade || '').trim();
      const k = chave(nicho, cidade);
      const a = agg.get(k) || { envios: 0, respostas: 0, rapidas: 0, reclamacoes: 0 };
      if (l.status !== 'falha') a.envios++;
      if (l.respondeu_em) a.respostas++;
      if (Number(l.segundos_para_resposta ?? 99999) <= 120) a.rapidas++;
      const erro = String(l.erro || '').toLowerCase();
      if (erro.includes('block') || erro.includes('spam') || erro.includes('131026') || erro.includes('132')) {
        a.reclamacoes++;
      }
      agg.set(k, a);
    }

    const linhas: any[] = [];
    for (const [k, a] of agg.entries()) {
      const [nicho, cidade] = k.split('||');
      const taxaResp = a.envios > 0 ? a.respostas / a.envios : 0;
      const taxaRapida = a.envios > 0 ? a.rapidas / a.envios : 0;
      const taxaRecl = a.envios > 0 ? a.reclamacoes / a.envios : 0;
      // Score: resposta pesa 60, resposta rápida (robô) pesa 40, reclamação penaliza forte.
      const score = Math.max(
        0,
        Math.round((taxaResp * 60 + taxaRapida * 40 - taxaRecl * 200) * 100) / 100,
      );
      linhas.push({
        nicho,
        cidade,
        envios: a.envios,
        respostas: a.respostas,
        respostas_rapidas: a.rapidas,
        reclamacoes: a.reclamacoes,
        score,
        bloqueado: a.reclamacoes > 0 && taxaRecl >= 0.02,
        atualizado_em: new Date().toISOString(),
      });
    }

    if (linhas.length > 0) {
      const { error } = await supabase
        .from('aquecimento_nicho_score')
        .upsert(linhas, { onConflict: 'nicho,cidade' });
      if (error) throw error;
    }

    // ===== Reposição de estoque =====
    const { count: estoque } = await supabase
      .from('google_maps_leads')
      .select('id', { count: 'exact', head: true })
      .eq('tem_whatsapp', true)
      .is('usado_aquecimento_em', null);

    const buscas: any[] = [];
    if ((estoque ?? 0) < ESTOQUE_MINIMO) {
      const melhores = linhas
        .filter((l) => !l.bloqueado && l.envios >= 5)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_BUSCAS_POR_RUN);

      // Sem histórico ainda: nichos-semente conhecidos por atendimento automático.
      const semente = [
        { nicho: 'clínica odontológica', cidade: 'Goiânia GO' },
        { nicho: 'psicólogo', cidade: 'Goiânia GO' },
      ];
      const alvos = melhores.length > 0
        ? melhores.map((m) => ({ nicho: m.nicho, cidade: m.cidade || 'Goiânia GO' }))
        : semente;

      for (const alvo of alvos.slice(0, MAX_BUSCAS_POR_RUN)) {
        try {
          const r = await supabase.functions.invoke('google-maps-buscar-leads', {
            body: { categoria: alvo.nicho, localizacao: alvo.cidade, max_resultados: 60, origem: 'aquecimento' },
          });
          buscas.push({ ...alvo, ok: !r.error, erro: r.error?.message ?? null });
        } catch (e) {
          buscas.push({ ...alvo, ok: false, erro: String(e).slice(0, 200) });
        }
      }
    }

    return json({ ok: true, dia, nichos: linhas.length, estoque: estoque ?? 0, buscas });
  } catch (e) {
    console.error('[meta-aquecimento-aprender]', e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
