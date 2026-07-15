// Consulta cotação USD/EUR diária e envia notificação com menor histórico
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";
import { notificarNumeros } from "../_shared/notificar-numeros.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DESTINATARIOS = ["62991672674", "62994300880"];
const DATA_INICIO_EVENTO = "15/07/2026";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const fmtDataBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Busca cotação AwesomeAPI (pública, sem chave)
    const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL");
    if (!res.ok) throw new Error(`AwesomeAPI HTTP ${res.status}`);
    const data = await res.json();
    const usd = parseFloat(data?.USDBRL?.bid);
    const eur = parseFloat(data?.EURBRL?.bid);
    if (!Number.isFinite(usd) || !Number.isFinite(eur)) throw new Error("cotacao_invalida");

    const nowBrt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hoje = nowBrt.toISOString().slice(0, 10);

    // Grava histórico diário (upsert)
    await supabase.from("cotacoes_moedas").upsert({ data: hoje, usd, eur }, { onConflict: "data" });

    // Compara com mínimo histórico
    const { data: minimas } = await supabase.from("cotacoes_minimas").select("*");
    const minMap = new Map<string, any>();
    (minimas || []).forEach((m: any) => minMap.set(m.moeda, m));

    let novoMinUsd = false;
    let novoMinEur = false;

    const minUsdAtual = minMap.get("USD");
    if (!minUsdAtual || usd < Number(minUsdAtual.valor)) {
      await supabase.from("cotacoes_minimas").upsert({ moeda: "USD", valor: usd, data_registro: hoje, updated_at: new Date().toISOString() }, { onConflict: "moeda" });
      novoMinUsd = true;
    }
    const minEurAtual = minMap.get("EUR");
    if (!minEurAtual || eur < Number(minEurAtual.valor)) {
      await supabase.from("cotacoes_minimas").upsert({ moeda: "EUR", valor: eur, data_registro: hoje, updated_at: new Date().toISOString() }, { onConflict: "moeda" });
      novoMinEur = true;
    }

    // Recarrega para pegar valores finais
    const { data: minFinal } = await supabase.from("cotacoes_minimas").select("*");
    const finalMap = new Map<string, any>();
    (minFinal || []).forEach((m: any) => finalMap.set(m.moeda, m));
    const minUsd = finalMap.get("USD");
    const minEur = finalMap.get("EUR");

    const linhas: string[] = [];
    linhas.push(`💱 *Cotação do dia*`);
    linhas.push("");
    linhas.push(`Hoje o valor do dólar é R$ ${fmtBRL(usd)} e o valor do euro é R$ ${fmtBRL(eur)}.`);
    linhas.push("");
    linhas.push(`Até o momento o menor valor registrado é de R$ ${fmtBRL(Number(minUsd?.valor ?? usd))} do dólar e R$ ${fmtBRL(Number(minEur?.valor ?? eur))} do euro, desde o dia ${DATA_INICIO_EVENTO}.`);
    if (novoMinUsd || novoMinEur) {
      linhas.push("");
      linhas.push(`🎉 *Novo mínimo histórico registrado hoje!*${novoMinUsd ? " USD" : ""}${novoMinEur ? " EUR" : ""}`);
    }

    const mensagem = linhas.join("\n");
    const chave = `cotacao-${hoje}`;

    const result = await notificarNumeros(supabase, {
      tipo: "cotacao_diaria",
      mensagem,
      destinatarios: DESTINATARIOS,
      chaveIdempotencia: chave,
    });

    return new Response(JSON.stringify({ ok: true, usd, eur, novoMinUsd, novoMinEur, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
