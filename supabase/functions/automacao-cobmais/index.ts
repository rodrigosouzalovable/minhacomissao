import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const userId = claimsData.claims.sub as string

    // Check admin
    const adminClient = createClient(
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

    const body = await req.json()
    const { action } = body

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
          .select('server_url, status')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!config?.server_url) {
          return new Response(JSON.stringify({ success: true, status: 'offline', message: 'URL do servidor não configurada' }), { headers: corsHeaders })
        }

        try {
          const res = await fetch(`${config.server_url}/status`, { 
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          })
          const data = await res.json()
          const newStatus = data.online ? 'online' : 'offline'
          
          await adminClient
            .from('automacao_config')
            .update({ status: newStatus, atualizado_em: new Date().toISOString() })
            .eq('id', config.server_url)

          return new Response(JSON.stringify({ success: true, status: newStatus, data }), { headers: corsHeaders })
        } catch {
          await adminClient
            .from('automacao_config')
            .update({ status: 'offline', atualizado_em: new Date().toISOString() })
            .not('server_url', 'eq', '')

          return new Response(JSON.stringify({ success: true, status: 'offline', message: 'Servidor não respondeu' }), { headers: corsHeaders })
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

        // Insert command
        const { data: comando } = await adminClient
          .from('automacao_comandos')
          .insert({ user_id: userId, acao, parametros: parametros || {}, status: 'executando' })
          .select('id')
          .single()

        const comandoId = comando?.id
        const startTime = Date.now()

        // Log start
        await adminClient.from('automacao_logs').insert({
          comando_id: comandoId,
          user_id: userId,
          tipo: 'info',
          mensagem: `Iniciando ação: ${acao}`,
          detalhes: parametros || {}
        })

        try {
          const res = await fetch(`${config.server_url}/automacao/cobmais`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao, parametros: parametros || {} }),
            signal: AbortSignal.timeout(120000)
          })
          const resultado = await res.json()
          const tempo = Date.now() - startTime

          if (res.ok && resultado.success !== false) {
            await adminClient
              .from('automacao_comandos')
              .update({ status: 'concluido', resultado, tempo_execucao_ms: tempo, executado_em: new Date().toISOString() })
              .eq('id', comandoId)

            await adminClient.from('automacao_logs').insert({
              comando_id: comandoId, user_id: userId, tipo: 'sucesso',
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
              comando_id: comandoId, user_id: userId, tipo: 'erro',
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
            comando_id: comandoId, user_id: userId, tipo: 'erro',
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
