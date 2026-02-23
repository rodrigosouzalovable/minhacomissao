import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Verificar autenticação do usuário chamando
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided')
      throw new Error('Não autorizado')
    }

    // 2. Criar cliente com token do usuário para verificar quem está chamando
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 3. Validar token via getClaims
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      console.error('Token validation error:', claimsError)
      throw new Error('Usuário não autenticado')
    }

    const callingUserId = claimsData.claims.sub
    const callingEmail = claimsData.claims.email
    console.log(`User ${callingEmail} attempting password reset`)

    // 4. Verificar se é admin usando a função has_role
    const { data: isAdmin, error: roleError } = await supabaseClient
      .rpc('has_role', { _user_id: callingUserId, _role: 'admin' })

    if (roleError) {
      console.error('Role check error:', roleError)
      throw new Error('Erro ao verificar permissões')
    }

    if (!isAdmin) {
      console.error(`User ${callingEmail} is not admin`)
      throw new Error('Apenas administradores podem redefinir senhas')
    }

    // 5. Obter dados da requisição
    const { userId, newPassword } = await req.json()
    
    if (!userId || !newPassword) {
      throw new Error('userId e newPassword são obrigatórios')
    }

    if (newPassword.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres')
    }

    // 6. Criar cliente admin para alterar senha
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 7. Atualizar senha do usuário alvo
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      throw updateError
    }

    // 8. Log da operação (para auditoria)
    console.log(`SUCCESS: Admin ${callingEmail} reset password for user ${userId}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Senha redefinida com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in reset-user-password:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
