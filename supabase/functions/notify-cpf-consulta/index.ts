import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificarAdmin } from '../_shared/notificar-admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, nome, credor, totalDebitos } = await req.json();
    console.log('Notificação de consulta CPF:', { cpf, nome, credor, totalDebitos });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const cpfLimpo = (cpf || '').replace(/\D/g, '');
    const cpfFormatado = cpfLimpo.length === 11
      ? `${cpfLimpo.slice(0, 3)}.${cpfLimpo.slice(3, 6)}.${cpfLimpo.slice(6, 9)}-${cpfLimpo.slice(9)}`
      : cpf;

    // Telefones cadastrados
    let telefonesFormatados = 'Não cadastrado';
    const { data: fonesTab } = await supabase
      .from('devedor_telefones')
      .select('numero')
      .eq('devedor_cpf', cpfLimpo)
      .eq('ativo', true);
    if (fonesTab && fonesTab.length > 0) {
      telefonesFormatados = fonesTab.map((f: any) => f.numero).join(', ');
    } else {
      const { data: devs } = await supabase
        .from('devedores')
        .select('telefone')
        .eq('cpf', cpfLimpo)
        .not('telefone', 'is', null)
        .limit(1);
      if (devs?.[0]?.telefone) telefonesFormatados = devs[0].telefone;
    }

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const mensagem = `📋 *CONSULTA NO PORTAL*

📌 *CPF:* ${cpfFormatado}
👤 *Nome:* ${nome || 'Não identificado'}
🏢 *Credor:* ${credor || 'N/A'}
📊 *Débitos encontrados:* ${totalDebitos ?? 0}
📞 *Telefone(s):* ${telefonesFormatados}
🕐 *Data/Hora:* ${agora}

_Portal de Acordos - Souza e Ribeiro_`;

    const result = await notificarAdmin(supabase, {
      tipo: 'consulta_cpf',
      mensagem,
    });

    return new Response(JSON.stringify({ success: !!result.success, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro notify-cpf-consulta:', error);
    return new Response(JSON.stringify({ success: false, error: String(error), fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
