// Testa cada instância selecionada enviando 1 mensagem real do template lembrete_envio_boleto
// para um telefone informado. Retorna resultado por instância.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEMPLATE_NOME = 'lembrete_envio_boleto';

function sb() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}
function rnd(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min; }
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function normalizePhone(raw: string) {
  const d = (raw||'').replace(/\D/g,'');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const instancia_ids: string[] = Array.isArray(body?.instancia_ids) ? body.instancia_ids : [];
    const telefone = normalizePhone(String(body?.telefone || ''));

    if (!telefone) {
      return new Response(JSON.stringify({ ok: false, error: 'Telefone inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    if (instancia_ids.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Nenhuma instância informada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }

    const supabase = sb();

    const { data: instRows } = await supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, saude_quality, ativo, pausa_automatica_ate')
      .in('id', instancia_ids);

    const { data: tpls } = await supabase
      .from('meta_whatsapp_templates')
      .select('id, nome_template, idioma, categoria, status, body_text, instancia_id, meta_template_name, header_type, header_text, footer_text, botoes, variaveis')
      .eq('nome_template', TEMPLATE_NOME)
      .eq('status', 'approved')
      .in('instancia_id', instancia_ids);
    const tplPorInst = new Map<string, any>();
    for (const t of tpls || []) tplPorInst.set(t.instancia_id, t);

    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const resultados: any[] = [];

    for (let i = 0; i < instancia_ids.length; i++) {
      const id = instancia_ids[i];
      const inst = (instRows || []).find((x: any) => x.id === id);
      const nome = inst?.nome || id;

      if (!inst) {
        resultados.push({ instancia_id: id, nome, ok: false, erro: 'Instância não encontrada' });
        continue;
      }
      if (!inst.ativo) {
        resultados.push({ instancia_id: id, nome, ok: false, erro: 'Instância inativa' });
        continue;
      }
      const q = String(inst.saude_quality || '').toUpperCase();
      if (q === 'RED' || q === 'YELLOW') {
        resultados.push({ instancia_id: id, nome, ok: false, erro: `Qualidade ${q} — bloqueada` });
        continue;
      }
      if (inst.pausa_automatica_ate && new Date(inst.pausa_automatica_ate).getTime() > Date.now()) {
        resultados.push({ instancia_id: id, nome, ok: false, erro: 'Instância em pausa automática' });
        continue;
      }
      const template = tplPorInst.get(id);
      if (!template) {
        resultados.push({ instancia_id: id, nome, ok: false, erro: `Template "${TEMPLATE_NOME}" não aprovado nesta instância` });
        continue;
      }

      const vars: Record<string, string> = { '1': 'Teste', '2': hoje };

      try {
        const { data: resp, error: sendErr } = await supabase.functions.invoke('send-whatsapp-meta', {
          body: {
            instancia_id: id,
            cliente: { telefone, nome: 'Teste', cpf: '', saldo: 0, vars },
            template,
          },
        });
        const success = !sendErr && resp?.success !== false && !resp?.error;
        const waId = resp?.waId || null;
        const errTxt = sendErr ? String(sendErr.message || sendErr) : (resp?.error || null);

        await supabase.from('meta_lembrete_log').insert({
          pagamento_id: null, acordo_id: null, user_id: null,
          tipo: 'teste', data_ref: new Date().toISOString().slice(0, 10),
          instancia_id: id, instancia_nome: nome,
          telefone, sucesso: success, erro: errTxt, wa_message_id: waId,
        });

        resultados.push({ instancia_id: id, nome, ok: success, erro: success ? null : (errTxt || 'Falha desconhecida'), wa_message_id: waId });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        resultados.push({ instancia_id: id, nome, ok: false, erro: err });
        await supabase.from('meta_lembrete_log').insert({
          tipo: 'teste', data_ref: new Date().toISOString().slice(0, 10),
          instancia_id: id, instancia_nome: nome,
          telefone, sucesso: false, erro: err,
        });
      }

      if (i < instancia_ids.length - 1) await sleep(rnd(2000, 4000));
    }

    const ok_count = resultados.filter(r => r.ok).length;
    const fail_count = resultados.length - ok_count;

    return new Response(JSON.stringify({ ok: true, resultados, ok_count, fail_count }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
});
