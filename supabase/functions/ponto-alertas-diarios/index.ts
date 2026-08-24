// Resumo diário de ponto no WhatsApp do administrador (quem não bateu entrada / esqueceu a saída).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";
import { dataBRT, horaBRT, diaSemanaBRT } from "../_shared/ponto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const momento = String(body?.momento ?? "manha"); // "manha" | "noite"
    const data = dataBRT();

    // Domingo não gera alerta
    if (diaSemanaBRT() === 0) {
      return new Response(JSON.stringify({ ok: true, ignorado: "domingo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: perfis }, { data: registros }, { data: jornadas }, { data: perms }] = await Promise.all([
      admin.from("profiles").select("id, nome, ativo"),
      admin.from("ponto_registros").select("user_id, tipo, registrado_em").eq("data", data),
      admin.from("ponto_jornada_config").select("user_id, ponto_obrigatorio"),
      admin.from("user_permissions").select("user_id").eq("bate_ponto", true),
    ]);

    const obrigadosPermissao = new Set<string>((perms ?? []).map((p: any) => p.user_id));

    const obrigatorio = new Map<string, boolean>(
      (jornadas ?? []).map((j: any) => [j.user_id, j.ponto_obrigatorio !== false]),
    );

    const porUser = new Map<string, string[]>();
    for (const r of registros ?? []) {
      const lista = porUser.get(r.user_id) ?? [];
      lista.push(r.tipo);
      porUser.set(r.user_id, lista);
    }

    const ativos = (perfis ?? []).filter((p: any) => p.ativo !== false && obrigatorio.get(p.id) !== false);

    let linhas: string[] = [];
    let titulo = "";

    if (momento === "manha") {
      titulo = `⏰ *Ponto ${data.split("-").reverse().join("/")}* — sem entrada até ${horaBRT()}`;
      linhas = ativos
        .filter((p: any) => !(porUser.get(p.id) ?? []).includes("entrada"))
        .map((p: any) => `• ${p.nome ?? p.id}`);
    } else {
      titulo = `🌙 *Ponto ${data.split("-").reverse().join("/")}* — sem saída registrada`;
      linhas = ativos
        .filter((p: any) => {
          const t = porUser.get(p.id) ?? [];
          return t.includes("entrada") && !t.includes("saida");
        })
        .map((p: any) => `• ${p.nome ?? p.id}`);
    }

    if (linhas.length === 0) {
      return new Response(JSON.stringify({ ok: true, pendentes: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mensagem = `${titulo}\n\n${linhas.join("\n")}\n\nTotal: ${linhas.length}`;

    await notificarNumeros(admin, {
      tipo: `ponto_alerta_${momento}`,
      mensagem,
      destinatarios: DESTINATARIOS,
      chaveIdempotencia: `ponto_${momento}_${data}`,
    });

    return new Response(JSON.stringify({ ok: true, pendentes: linhas.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
