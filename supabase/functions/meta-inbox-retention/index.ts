// Retenção do Inbox Meta:
// Arquiva (não apaga) conversas onde NÓS abrimos e o cliente NUNCA respondeu,
// após 3 dias sem atividade. Conversas com qualquer mensagem de entrada
// (ultima_msg_entrada_em preenchida OU mensagem de entrada registrada em
// meta_whatsapp_mensagens) NUNCA são tocadas.
// Reaparecem automaticamente quando o cliente responde (webhook desarquiva).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const corte = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    let arquivados = 0;
    let candidatosTotal = 0;
    let bloqueadosTotal = 0;

    // Até 6 passadas de 1000 (limite do Data API) por execução horária
    for (let passada = 0; passada < 6; passada++) {
      // Contatos candidatos: sem entrada, não fixados, não arquivados,
      // sem não lidas, com ultima_mensagem_em < 24h.
      const { data: candidatos, error } = await supabase
        .from("meta_whatsapp_contatos")
        .select("id")
        .is("ultima_msg_entrada_em", null)
        .eq("arquivado", false)
        .eq("fixado", false)
        .eq("nao_lido", 0)
        .lt("ultima_mensagem_em", corte)
        .order("ultima_mensagem_em", { ascending: true })
        .limit(1000);

      if (error) throw error;
      if (!candidatos?.length) break;

      // Exclui contatos que possuem etiquetas aplicadas (marca gestão manual)
      const ids = candidatos.map((c: any) => c.id);
      candidatosTotal += ids.length;
      const { data: comEtiq } = await supabase
        .from("meta_whatsapp_contato_etiquetas")
        .select("contato_id")
        .in("contato_id", ids);
      const bloqueados = new Set((comEtiq || []).map((r: any) => r.contato_id));
      bloqueadosTotal += bloqueados.size;
      const paraArquivar = ids.filter((id) => !bloqueados.has(id));
      if (paraArquivar.length === 0) break; // só restaram protegidos

      for (let i = 0; i < paraArquivar.length; i += 500) {
        const slice = paraArquivar.slice(i, i + 500);
        const { error: upE } = await supabase
          .from("meta_whatsapp_contatos")
          .update({ arquivado: true })
          .in("id", slice);
        if (!upE) arquivados += slice.length;
      }

      if (ids.length < 1000) break;
    }

    return json({ ok: true, arquivados, candidatos: candidatosTotal, bloqueados_etiqueta: bloqueadosTotal });

  } catch (e) {
    console.error("[meta-inbox-retention]", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
