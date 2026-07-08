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

    // Rodízio: distribui a notificação entre usuários com permissão.
    // Fallback: se ninguém tiver a permissão ativada, cai no rodízio entre admins.
    try {
      const { data: pool } = await supabase
        .from('user_permissions')
        .select('user_id')
        .eq('recebe_consulta_cpf', true);

      let userIds = (pool || []).map((p: any) => p.user_id).filter(Boolean);

      if (userIds.length === 0) {
        const { data: admins } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin');
        userIds = (admins || []).map((a: any) => a.user_id).filter(Boolean);
        console.log('Pool vazio, usando fallback admins:', userIds.length);
      }

      if (userIds.length > 0) {
        // Busca último atribuído por usuário para ordenar (menos recente primeiro)
        const { data: ultimos } = await supabase
          .from('consulta_cpf_notificacoes')
          .select('assigned_user_id, created_at')
          .in('assigned_user_id', userIds)
          .order('created_at', { ascending: false });

        const ultimoPorUsuario = new Map<string, string>();
        for (const row of (ultimos || []) as any[]) {
          if (!ultimoPorUsuario.has(row.assigned_user_id)) {
            ultimoPorUsuario.set(row.assigned_user_id, row.created_at);
          }
        }

        // Ordena: quem nunca recebeu primeiro; empates pelo user_id (estável)
        const ordenados = [...userIds].sort((a, b) => {
          const ua = ultimoPorUsuario.get(a);
          const ub = ultimoPorUsuario.get(b);
          if (!ua && !ub) return a.localeCompare(b);
          if (!ua) return -1;
          if (!ub) return 1;
          return ua.localeCompare(ub); // ISO strings ordenam cronologicamente
        });

        const proximo = ordenados[0];
        const { error: insErr } = await supabase
          .from('consulta_cpf_notificacoes')
          .insert({
            cpf: cpfLimpo,
            nome: nome || null,
            credor: credor || null,
            total_debitos: totalDebitos ?? 0,
            telefones: telefonesFormatados,
            assigned_user_id: proximo,
          });
        if (insErr) console.error('Erro inserindo notificação rodízio:', insErr);
      } else {
        console.warn('Sem usuários elegíveis (nem pool nem admins) para notificação de CPF');
      }
    } catch (rodizioErr) {
      console.error('Erro no rodízio de notificação:', rodizioErr);

    }

    // Mantém fallback WhatsApp para o admin
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
