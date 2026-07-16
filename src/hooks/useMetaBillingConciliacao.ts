import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MetaInstancePagamento } from "@/hooks/useMetaInstancePagamentos";

export type MetaBillingInstanciaBase = {
  id: string;
  nome: string;
  display_phone: string | null;
  waba_id: string;
};

type SnapshotRow = {
  waba_id: string;
  dia: string;
  conversation_category: string | null;
  conversation_type: string | null;
  conversations_count: number | null;
  cost_usd: number | null;
  cost_brl: number | null;
};

type EnvioRow = {
  instancia_id: string | null;
  template_nome: string | null;
  status: string | null;
  foi_gratis: boolean | null;
  pricing_category: string | null;
  pricing_type: string | null;
};

type TemplateRow = {
  instancia_id: string | null;
  nome_template: string | null;
  categoria: string | null;
};

export type MetaConciliacaoInstancia = {
  id: string;
  nome: string;
  displayPhone: string | null;
  wabaId: string;
  enviosSent: number;
  enviosSemPricing: number;
  conversasSnapshot: number;
  conversasCobradas: number;
  conversasGratis: number;
  oficialUsd: number;
  oficialBrl: number;
  utilityUsd: number;
  marketingUsd: number;
  faturasUsd: number;
  faturasCount: number;
  diferencaUsd: number;
  primeiraFatura: string | null;
  ultimaFatura: string | null;
  status: "ok" | "atencao" | "critico";
  motivo: string;
};

export type MetaConciliacaoOrfao = {
  wabaId: string;
  conversasSnapshot: number;
  oficialUsd: number;
};

export type MetaConciliacaoTemplateSemPricing = {
  templateNome: string;
  qtd: number;
};

export type MetaBillingConciliacao = {
  totais: {
    faturasUsd: number;
    oficialUsd: number;
    oficialBrl: number;
    diferencaUsd: number;
    conversasSnapshot: number;
    conversasCobradas: number;
    conversasGratis: number;
    utilityCobradas: number;
    utilityUsd: number;
    marketingCobradas: number;
    marketingUsd: number;
    precoMedioUtility: number;
    enviosSent: number;
    enviosSemPricing: number;
    ultimaDataSnapshot: string | null;
  };
  instancias: MetaConciliacaoInstancia[];
  orfaos: MetaConciliacaoOrfao[];
  templatesSemPricing: MetaConciliacaoTemplateSemPricing[];
  alertas: string[];
};

const num = (v: unknown) => Number(v || 0);
const upper = (v: unknown) => String(v || "").toUpperCase();

const isFreeSnapshot = (row: SnapshotRow) => {
  const tipo = upper(row.conversation_type);
  const cat = upper(row.conversation_category);
  return num(row.cost_usd) === 0 || cat === "SERVICE" || tipo.includes("FREE");
};

export function useMetaBillingConciliacao(
  instancias: MetaBillingInstanciaBase[],
  pagamentos: MetaInstancePagamento[],
) {
  const pagamentosKey = useMemo(
    () => pagamentos.map((p) => `${p.id}:${p.valor_usd}:${p.instance_id}`).join("|"),
    [pagamentos],
  );
  const instanciasKey = useMemo(
    () => instancias.map((i) => `${i.id}:${i.waba_id}`).join("|"),
    [instancias],
  );

  return useQuery({
    queryKey: ["meta-billing-conciliacao", instanciasKey, pagamentosKey],
    enabled: instancias.length > 0 || pagamentos.length > 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MetaBillingConciliacao> => {
      const [snapRes, envRes, tplRes] = await Promise.all([
        (supabase as any)
          .from("meta_billing_snapshot")
          .select("waba_id,dia,conversation_category,conversation_type,conversations_count,cost_usd,cost_brl")
          .order("dia", { ascending: false })
          .limit(20000),
        (supabase as any)
          .from("meta_whatsapp_envios_log")
          .select("instancia_id,template_nome,status,foi_gratis,pricing_category,pricing_type")
          .eq("status", "sent")
          .limit(100000),
        (supabase as any)
          .from("meta_whatsapp_templates")
          .select("instancia_id,nome_template,categoria")
          .limit(20000),
      ]);

      if (snapRes.error) throw snapRes.error;
      if (envRes.error) throw envRes.error;
      if (tplRes.error) throw tplRes.error;

      const snapshots = (snapRes.data || []) as SnapshotRow[];
      const envios = (envRes.data || []) as EnvioRow[];
      const templates = (tplRes.data || []) as TemplateRow[];

      const templateCategoria = new Map<string, string>();
      for (const t of templates) {
        if (!t.instancia_id || !t.nome_template || !t.categoria) continue;
        templateCategoria.set(`${t.instancia_id}::${t.nome_template}`, upper(t.categoria));
      }

      const byWaba = new Map<string, {
        conversasSnapshot: number;
        conversasCobradas: number;
        conversasGratis: number;
        oficialUsd: number;
        oficialBrl: number;
        utilityUsd: number;
        utilityCobradas: number;
        marketingUsd: number;
        marketingCobradas: number;
      }>();

      let ultimaDataSnapshot: string | null = null;
      for (const s of snapshots) {
        const waba = String(s.waba_id || "");
        if (!waba) continue;
        const cur = byWaba.get(waba) || {
          conversasSnapshot: 0,
          conversasCobradas: 0,
          conversasGratis: 0,
          oficialUsd: 0,
          oficialBrl: 0,
          utilityUsd: 0,
          utilityCobradas: 0,
          marketingUsd: 0,
          marketingCobradas: 0,
        };
        const conv = num(s.conversations_count);
        const usd = num(s.cost_usd);
        const brl = num(s.cost_brl);
        const cat = upper(s.conversation_category);
        cur.conversasSnapshot += conv;
        cur.oficialUsd += usd;
        cur.oficialBrl += brl;
        if (isFreeSnapshot(s)) cur.conversasGratis += conv;
        else cur.conversasCobradas += conv;
        if (cat === "UTILITY" && usd > 0) {
          cur.utilityUsd += usd;
          cur.utilityCobradas += conv;
        }
        if (cat === "MARKETING" && usd > 0) {
          cur.marketingUsd += usd;
          cur.marketingCobradas += conv;
        }
        byWaba.set(waba, cur);
        if (!ultimaDataSnapshot || s.dia > ultimaDataSnapshot) ultimaDataSnapshot = s.dia;
      }

      const enviosByInst = new Map<string, { sent: number; semPricing: number }>();
      const templatesSemPricing = new Map<string, number>();
      for (const e of envios) {
        const instId = e.instancia_id || "";
        if (!instId || e.status !== "sent") continue;
        const cur = enviosByInst.get(instId) || { sent: 0, semPricing: 0 };
        cur.sent += 1;
        if (!e.pricing_category) {
          cur.semPricing += 1;
          const nome = e.template_nome || "Sem template";
          templatesSemPricing.set(nome, (templatesSemPricing.get(nome) || 0) + 1);
        }
        enviosByInst.set(instId, cur);

        if (!e.pricing_category && e.template_nome) {
          const inferred = templateCategoria.get(`${instId}::${e.template_nome}`);
          if (inferred) {
            // Mantém apenas o diagnóstico no hook; a correção definitiva é feita por backfill controlado no banco.
          }
        }
      }

      const pagamentosByInst = new Map<string, { usd: number; count: number; primeira: string | null; ultima: string | null }>();
      for (const p of pagamentos) {
        const cur = pagamentosByInst.get(p.instance_id) || { usd: 0, count: 0, primeira: null, ultima: null };
        cur.usd += num(p.valor_usd);
        cur.count += 1;
        if (!cur.primeira || p.data_transacao < cur.primeira) cur.primeira = p.data_transacao;
        if (!cur.ultima || p.data_transacao > cur.ultima) cur.ultima = p.data_transacao;
        pagamentosByInst.set(p.instance_id, cur);
      }

      const wabasConhecidas = new Set(instancias.map((i) => i.waba_id).filter(Boolean));
      const instanciasConc = instancias.map((inst) => {
        const snap = byWaba.get(inst.waba_id) || {
          conversasSnapshot: 0,
          conversasCobradas: 0,
          conversasGratis: 0,
          oficialUsd: 0,
          oficialBrl: 0,
          utilityUsd: 0,
          utilityCobradas: 0,
          marketingUsd: 0,
          marketingCobradas: 0,
        };
        const env = enviosByInst.get(inst.id) || { sent: 0, semPricing: 0 };
        const fat = pagamentosByInst.get(inst.id) || { usd: 0, count: 0, primeira: null, ultima: null };
        const diferencaUsd = fat.usd - snap.oficialUsd;
        let status: MetaConciliacaoInstancia["status"] = "ok";
        let motivo = "Faturas compatíveis com o custo oficial identificado.";
        if (fat.usd >= 24.5 && snap.oficialUsd < 1) {
          status = "critico";
          motivo = "Fatura perto de US$25, mas o consumo oficial desta WABA é menor que US$1.";
        } else if (fat.usd > 0 && snap.conversasSnapshot === 0) {
          status = "critico";
          motivo = "Há fatura importada, mas não há billing oficial para esta WABA.";
        } else if (diferencaUsd > 5) {
          status = "atencao";
          motivo = "Faturas importadas estão acima do custo oficial desta WABA.";
        } else if (env.semPricing > 0) {
          status = "atencao";
          motivo = "Existem envios sem categoria de pricing capturada no log interno.";
        }
        return {
          id: inst.id,
          nome: inst.nome,
          displayPhone: inst.display_phone,
          wabaId: inst.waba_id,
          enviosSent: env.sent,
          enviosSemPricing: env.semPricing,
          conversasSnapshot: snap.conversasSnapshot,
          conversasCobradas: snap.conversasCobradas,
          conversasGratis: snap.conversasGratis,
          oficialUsd: snap.oficialUsd,
          oficialBrl: snap.oficialBrl,
          utilityUsd: snap.utilityUsd,
          marketingUsd: snap.marketingUsd,
          faturasUsd: fat.usd,
          faturasCount: fat.count,
          diferencaUsd,
          primeiraFatura: fat.primeira,
          ultimaFatura: fat.ultima,
          status,
          motivo,
        };
      }).sort((a, b) => Math.abs(b.diferencaUsd) - Math.abs(a.diferencaUsd));

      const orfaos = Array.from(byWaba.entries())
        .filter(([waba, snap]) => !wabasConhecidas.has(waba) && snap.conversasSnapshot > 0)
        .map(([wabaId, snap]) => ({
          wabaId,
          conversasSnapshot: snap.conversasSnapshot,
          oficialUsd: snap.oficialUsd,
        }))
        .sort((a, b) => b.oficialUsd - a.oficialUsd);

      const totais = {
        faturasUsd: pagamentos.reduce((s, p) => s + num(p.valor_usd), 0),
        oficialUsd: snapshots.reduce((s, r) => s + num(r.cost_usd), 0),
        oficialBrl: snapshots.reduce((s, r) => s + num(r.cost_brl), 0),
        diferencaUsd: 0,
        conversasSnapshot: snapshots.reduce((s, r) => s + num(r.conversations_count), 0),
        conversasCobradas: snapshots.reduce((s, r) => s + (isFreeSnapshot(r) ? 0 : num(r.conversations_count)), 0),
        conversasGratis: snapshots.reduce((s, r) => s + (isFreeSnapshot(r) ? num(r.conversations_count) : 0), 0),
        utilityCobradas: snapshots.reduce((s, r) => s + (upper(r.conversation_category) === "UTILITY" && num(r.cost_usd) > 0 ? num(r.conversations_count) : 0), 0),
        utilityUsd: snapshots.reduce((s, r) => s + (upper(r.conversation_category) === "UTILITY" ? num(r.cost_usd) : 0), 0),
        marketingCobradas: snapshots.reduce((s, r) => s + (upper(r.conversation_category) === "MARKETING" && num(r.cost_usd) > 0 ? num(r.conversations_count) : 0), 0),
        marketingUsd: snapshots.reduce((s, r) => s + (upper(r.conversation_category) === "MARKETING" ? num(r.cost_usd) : 0), 0),
        precoMedioUtility: 0,
        enviosSent: Array.from(enviosByInst.values()).reduce((s, r) => s + r.sent, 0),
        enviosSemPricing: Array.from(enviosByInst.values()).reduce((s, r) => s + r.semPricing, 0),
        ultimaDataSnapshot,
      };
      totais.diferencaUsd = totais.faturasUsd - totais.oficialUsd;
      totais.precoMedioUtility = totais.utilityCobradas > 0 ? totais.utilityUsd / totais.utilityCobradas : 0;

      const alertas: string[] = [];
      if (totais.marketingCobradas === 0) {
        alertas.push("Não há conversas MARKETING cobradas no billing oficial sincronizado.");
      }
      if (totais.diferencaUsd > 10) {
        alertas.push(`As faturas importadas estão US$ ${totais.diferencaUsd.toFixed(2)} acima do custo oficial de conversas.`);
      }
      if (orfaos.length > 0) {
        alertas.push(`${orfaos.length} WABA(s) aparecem no billing oficial sem instância cadastrada atualmente.`);
      }
      if (totais.enviosSemPricing > 0) {
        alertas.push(`${totais.enviosSemPricing} envio(s) ainda estavam sem categoria de pricing no log interno.`);
      }

      return {
        totais,
        instancias: instanciasConc,
        orfaos,
        templatesSemPricing: Array.from(templatesSemPricing.entries())
          .map(([templateNome, qtd]) => ({ templateNome, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
        alertas,
      };
    },
  });
}