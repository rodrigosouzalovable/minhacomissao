import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireCaller } from '../_shared/auth-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const caller = await requireCaller(req, { user: 'admin', corsHeaders })
  if (caller instanceof Response) return caller

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    console.log(`User ${caller.userId ?? caller.kind} attempting password reset`)

    // Criar cliente admin
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { userId, newPassword } = await req.json()
    
    if (!userId || !newPassword) {
      throw new Error('userId e newPassword são obrigatórios')
    }

    if (newPassword.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres')
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Password update error:', updateError)
      throw updateError
    }

    console.log(`SUCCESS: Admin ${caller.userId ?? caller.kind} reset password for user ${userId}`)

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
