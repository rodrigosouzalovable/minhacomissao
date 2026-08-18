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

  // Caixa AQUECIMENTO: nunca arquiva (números UAZAPI atendidos pelo IAGO)
  const FOLDER_AQUECIMENTO = "4f7a52c0-9c86-4b80-8867-4ade7a6df441";

  try {
    const corte = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();


    let arquivados = 0;
    let candidatosTotal = 0;
    let bloqueadosTotal = 0;

    // Até 6 passadas de 1000 (limite do Data API) por execução horária
    for (let passada = 0; passada < 6; passada++) {
      // Contatos candidatos: sem entrada, não fixados, não arquivados,
      // sem não lidas, com ultima_mensagem_em < 3 dias.
      const { data: candidatos, error } = await supabase
        .from("meta_whatsapp_contatos")
        .select("id, instancia_id, telefone")
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

      // Rede de proteção: se existir QUALQUER mensagem de entrada real dessa
      // conversa (mesma instância, sufixo de 8 dígitos), nunca arquiva.
      for (let i = 0; i < candidatos.length; i += 200) {
        const bloco = candidatos.slice(i, i + 200).filter((c: any) => !bloqueados.has(c.id) && c.telefone);
        if (bloco.length === 0) continue;
        const sufixos = bloco.map((c: any) => String(c.telefone).replace(/\D/g, "").slice(-8));
        const { data: entradas } = await supabase
          .from("meta_whatsapp_mensagens")
          .select("instancia_id, telefone")
          .eq("direcao", "entrada")
          .in("instancia_id", Array.from(new Set(bloco.map((c: any) => c.instancia_id))))
          .or(sufixos.map((s: string) => `telefone.ilike.%${s}`).join(","));
        const chaves = new Set(
          (entradas || []).map((m: any) => `${m.instancia_id}|${String(m.telefone || "").replace(/\D/g, "").slice(-8)}`),
        );
        for (const c of bloco) {
          const k = `${c.instancia_id}|${String(c.telefone).replace(/\D/g, "").slice(-8)}`;
          if (chaves.has(k)) bloqueados.add(c.id);
        }
      }

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
