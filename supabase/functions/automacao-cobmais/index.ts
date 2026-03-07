import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action } = body

    // Internal calls from other edge functions skip auth
    const isInternalCall = body._internal === true

    let userId = 'system'
    let adminClient: any

    if (isInternalCall) {
      adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
    } else {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
      userId = user.id

      adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { data: roleData } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle()

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: corsHeaders })
      }
    }

    switch (action) {
      case 'get_config': {
        const { data } = await adminClient
          .from('automacao_config')
          .select('*')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()
        return new Response(JSON.stringify({ success: true, config: data }), { headers: corsHeaders })
      }

      case 'save_config': {
        const { server_url, cobmais_email, cobmais_senha } = body
        const { data: existing } = await adminClient
          .from('automacao_config')
          .select('id')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing) {
          await adminClient
            .from('automacao_config')
            .update({ server_url, cobmais_email, cobmais_senha, atualizado_em: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await adminClient
            .from('automacao_config')
            .insert({ user_id: userId, server_url, cobmais_email, cobmais_senha })
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
      }

      case 'status': {
        const { data: config } = await adminClient
          .from('automacao_config')
          .select('id, server_url, status')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!config?.server_url) {
          return new Response(JSON.stringify({ success: true, status: 'offline', message: 'URL do servidor não configurada' }), { headers: corsHeaders })
        }

        try {
          const res = await fetch(`${config.server_url}/status`, { 
            method: 'GET',
            headers: {
              'ngrok-skip-browser-warning': 'true',
              'User-Agent': 'MeusAcordos/1.0',
            },
            signal: AbortSignal.timeout(5000)
          })
          const data = await res.json()
          const newStatus = data.status === 'online' || data.online ? 'online' : 'offline'
          
          await adminClient
            .from('automacao_config')
            .update({ status: newStatus, atualizado_em: new Date().toISOString() })
            .eq('id', config.id)

          return new Response(JSON.stringify({ success: true, status: newStatus, data }), { headers: corsHeaders })
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Servidor não respondeu'
          console.error('Status check error:', errorMsg)
          
          await adminClient
            .from('automacao_config')
            .update({ status: 'offline', atualizado_em: new Date().toISOString() })
            .eq('id', config.id)

          return new Response(JSON.stringify({ success: true, status: 'offline', message: errorMsg }), { headers: corsHeaders })
        }
      }

      case 'execute': {
        const { acao, parametros } = body
        if (!acao) {
          return new Response(JSON.stringify({ error: 'Campo acao é obrigatório' }), { status: 400, headers: corsHeaders })
        }

        const { data: config } = await adminClient
          .from('automacao_config')
          .select('server_url')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!config?.server_url) {
          return new Response(JSON.stringify({ error: 'URL do servidor não configurada' }), { status: 400, headers: corsHeaders })
        }

        // Determine timeout based on action type
        const timeoutMs = acao === 'gerar_boleto' ? 180000 : 120000

        const { data: comando } = await adminClient
          .from('automacao_comandos')
          .insert({ user_id: userId === 'system' ? '00000000-0000-0000-0000-000000000000' : userId, acao, parametros: parametros || {}, status: 'executando' })
          .select('id')
          .single()

        const comandoId = comando?.id
        const startTime = Date.now()

        await adminClient.from('automacao_logs').insert({
          comando_id: comandoId, user_id: userId === 'system' ? '00000000-0000-0000-0000-000000000000' : userId, tipo: 'info',
          mensagem: `Iniciando ação: ${acao}`, detalhes: parametros || {}
        })

        try {
          const res = await fetch(`${config.server_url}/automacao/cobmais`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
              'User-Agent': 'MeusAcordos/1.0',
            },
            body: JSON.stringify({ acao, parametros: parametros || {} }),
            signal: AbortSignal.timeout(timeoutMs)
          })
          const resultado = await res.json()
          const tempo = Date.now() - startTime

          if (res.ok && resultado.success !== false) {
            // Validate gerar_boleto must return boleto_url
            if (acao === 'gerar_boleto' && !resultado.boleto_url) {
              const erro = 'Robô retornou sucesso mas sem boleto_url — fluxo incompleto'
              console.error(`[gerar_boleto] FALHA: resultado sem boleto_url. Resultado completo:`, JSON.stringify(resultado))

              await adminClient
                .from('automacao_comandos')
                .update({ status: 'erro', erro, resultado, tempo_execucao_ms: tempo, executado_em: new Date().toISOString() })
                .eq('id', comandoId)

              await adminClient.from('automacao_logs').insert({
                comando_id: comandoId, user_id: userId === 'system' ? '00000000-0000-0000-0000-000000000000' : userId, tipo: 'erro',
                mensagem: erro, detalhes: resultado
              })

              return new Response(JSON.stringify({ success: false, error: erro, resultado, tempo_ms: tempo }), { headers: corsHeaders })
            }

            await adminClient
              .from('automacao_comandos')
              .update({ status: 'concluido', resultado, tempo_execucao_ms: tempo, executado_em: new Date().toISOString() })
              .eq('id', comandoId)

            await adminClient.from('automacao_logs').insert({
              comando_id: comandoId, user_id: userId === 'system' ? '00000000-0000-0000-0000-000000000000' : userId, tipo: 'sucesso',
              mensagem: `Ação ${acao} concluída em ${tempo}ms`, detalhes: resultado
            })

            return new Response(JSON.stringify({ success: true, resultado, tempo_ms: tempo }), { headers: corsHeaders })
          } else {
            const erro = resultado.error || 'Erro desconhecido'
            await adminClient
              .from('automacao_comandos')
              .update({ status: 'erro', erro, tempo_execucao_ms: tempo, executado_em: new Date().toISOString() })
              .eq('id', comandoId)

            await adminClient.from('automacao_logs').insert({
              comando_id: comandoId, user_id: userId === 'system' ? '00000000-0000-0000-0000-000000000000' : userId, tipo: 'erro',
              mensagem: `Erro na ação ${acao}: ${erro}`, detalhes: resultado
            })

            return new Response(JSON.stringify({ success: false, error: erro, tempo_ms: tempo }), { headers: corsHeaders })
          }
        } catch (err) {
          const tempo = Date.now() - startTime
          const erro = err instanceof Error ? err.message : 'Erro de conexão'

          await adminClient
            .from('automacao_comandos')
            .update({ status: 'erro', erro, tempo_execucao_ms: tempo, executado_em: new Date().toISOString() })
            .eq('id', comandoId)

          await adminClient.from('automacao_logs').insert({
            comando_id: comandoId, user_id: userId === 'system' ? '00000000-0000-0000-0000-000000000000' : userId, tipo: 'erro',
            mensagem: `Falha na ação ${acao}: ${erro}`
          })

          return new Response(JSON.stringify({ success: false, error: erro, tempo_ms: tempo }), { headers: corsHeaders })
        }
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), { status: 400, headers: corsHeaders })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders })
  }
})
