// Helper compartilhado para enviar notificações ao admin via WhatsApp
// Round-robin entre instâncias ativas, com idempotência
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

export interface NotificarAdminParams {
  tipo: string;
  mensagem: string;
  chaveIdempotencia?: string;
  forcarFlag?: keyof FlagsToggle;
}

export interface FlagsToggle {
  notificar_chip_pausado: boolean;
  notificar_chip_desconectado: boolean;
  notificar_resumo_diario: boolean;
  notificar_proxies_faltando: boolean;
}

export async function notificarAdmin(
  supabase: SupabaseClient,
  params: NotificarAdminParams,
): Promise<{ success: boolean; skipped?: string; error?: string }> {
  try {
    const { data: cfg } = await supabase
      .from("admin_notificacoes_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!cfg) return { success: false, error: "config_ausente" };

    if (params.forcarFlag && cfg[params.forcarFlag] === false) {
      return { success: false, skipped: "flag_desativada" };
    }

    if (params.chaveIdempotencia) {
      const { data: ja } = await supabase
        .from("admin_notificacoes_log")
        .select("id")
        .eq("tipo", params.tipo)
        .eq("chave_idempotencia", params.chaveIdempotencia)
        .maybeSingle();
      if (ja) return { success: false, skipped: "ja_enviado" };
    }

    // Round-robin: pega próxima instância ativa após a última usada
    const { data: insts } = await supabase
      .from("user_whatsapp_instances")
      .select("id, server_url, instance_token, nome")
      .eq("ativo", true)
      .order("id", { ascending: true });

    if (!insts?.length) return { success: false, error: "sem_instancia_ativa" };

    let idx = 0;
    if (cfg.ultima_instancia_id) {
      const ultIdx = insts.findIndex((i: any) => i.id === cfg.ultima_instancia_id);
      idx = (ultIdx + 1) % insts.length;
    }

    const numero = String(cfg.admin_phone).replace(/\D/g, "");
    const numeroFinal = numero.startsWith("55") ? numero : `55${numero}`;
    const mensagemFinal = `🤖 *Aviso Sistema*\n\n${params.mensagem}`;

    // Tenta até N instâncias em round-robin (pula desconectadas)
    const maxTent = Math.min(insts.length, 10);
    let ultimoErro = "sem_tentativas";
    for (let t = 0; t < maxTent; t++) {
      const inst: any = insts[(idx + t) % insts.length];
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(`${inst.server_url}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
          body: JSON.stringify({ number: numeroFinal, text: mensagemFinal }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const respText = await res.text();
        const desconectado = respText.toLowerCase().includes("disconnected") || respText.toLowerCase().includes("not reconnectable");
        if (res.ok) {
          await supabase.from("admin_notificacoes_log").insert({
            tipo: params.tipo,
            chave_idempotencia: params.chaveIdempotencia ?? null,
            mensagem: params.mensagem,
            instancia_envio_id: inst.id,
            status: "enviado",
          });
          await supabase
            .from("admin_notificacoes_config")
            .update({ ultima_instancia_id: inst.id, updated_at: new Date().toISOString() })
            .eq("id", 1);
          return { success: true };
        }
        ultimoErro = respText.substring(0, 200);
        if (!desconectado) break;
      } catch (e) {
        ultimoErro = String(e).substring(0, 200);
      }
    }

    await supabase.from("admin_notificacoes_log").insert({
      tipo: params.tipo,
      chave_idempotencia: params.chaveIdempotencia ?? null,
      mensagem: params.mensagem,
      status: "erro",
      erro_detalhe: ultimoErro,
    });
    return { success: false, error: ultimoErro };
  } catch (e) {
    return { success: false, error: String(e).substring(0, 200) };
  }
}
