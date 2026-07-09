import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // pega todas as instâncias que têm ao menos um template PENDING/ENVIADO
    const { data: pendentes } = await supabase
      .from("meta_templates_instancia")
      .select("instancia_id")
      .in("status", ["PENDING", "ENVIADO"]);

    const instIds = Array.from(new Set((pendentes || []).map((r) => r.instancia_id)));
    if (instIds.length === 0) {
      return new Response(JSON.stringify({ success: true, atualizados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instancias } = await supabase
      .from("meta_whatsapp_instances")
      .select("id, waba_id, access_token")
      .in("id", instIds);

    let atualizados = 0;

    for (const inst of instancias || []) {
      if (!inst.waba_id || !inst.access_token) continue;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${inst.waba_id}/message_templates?fields=name,language,status,id,rejected_reason&limit=200`,
          { headers: { Authorization: `Bearer ${inst.access_token}` } },
        );
        const data = await res.json();
        if (!res.ok) continue;

        const remotos: any[] = data.data || [];
        const remotoById = new Map(remotos.map((t) => [String(t.id), t]));
        const remotoByName = new Map(remotos.map((t) => [`${t.name}|${t.language}`, t]));

        const { data: locais } = await supabase
          .from("meta_templates_instancia")
          .select("id, meta_template_id, template_mestre_id, status")
          .eq("instancia_id", inst.id)
          .in("status", ["PENDING", "ENVIADO"]);

        for (const local of locais || []) {
          let remoto: any = null;
          if (local.meta_template_id) remoto = remotoById.get(String(local.meta_template_id));
          if (!remoto) {
            const { data: mestre } = await supabase
              .from("meta_templates_mestre").select("nome, idioma")
              .eq("id", local.template_mestre_id).maybeSingle();
            if (mestre) remoto = remotoByName.get(`${mestre.nome}|${mestre.idioma}`);
          }
          if (!remoto) continue;

          const novoStatus = String(remoto.status || "PENDING").toUpperCase();
          if (novoStatus === local.status) continue;

          await supabase.from("meta_templates_instancia").update({
            status: novoStatus,
            meta_template_id: remoto.id ? String(remoto.id) : local.meta_template_id,
            motivo_rejeicao: remoto.rejected_reason || null,
          }).eq("id", local.id);
          atualizados++;
        }
      } catch (_e) {
        // segue para próxima instância
      }
    }

    return new Response(JSON.stringify({ success: true, atualizados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
