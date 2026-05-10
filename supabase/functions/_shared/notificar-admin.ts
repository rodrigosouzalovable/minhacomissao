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
    const inst: any = insts[idx];

    const numero = String(cfg.admin_phone).replace(/\D/g, "");
    const numeroFinal = numero.startsWith("55") ? numero : `55${numero}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const mensagemFinal = `🤖 *Aviso Sistema*\n\n${params.mensagem}`;

    const res = await fetch(`${inst.server_url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: inst.instance_token },
      body: JSON.stringify({ number: numeroFinal, text: mensagemFinal }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const respText = await res.text();
    const ok = res.ok;

    await supabase.from("admin_notificacoes_log").insert({
      tipo: params.tipo,
      chave_idempotencia: params.chaveIdempotencia ?? null,
      mensagem: params.mensagem,
      instancia_envio_id: inst.id,
      status: ok ? "enviado" : "erro",
      erro_detalhe: ok ? null : respText.substring(0, 250),
    });

    if (ok) {
      await supabase
        .from("admin_notificacoes_config")
        .update({ ultima_instancia_id: inst.id, updated_at: new Date().toISOString() })
        .eq("id", 1);
    }

    return ok ? { success: true } : { success: false, error: respText.substring(0, 150) };
  } catch (e) {
    return { success: false, error: String(e).substring(0, 200) };
  }
}
