import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, DollarSign, Loader2 } from "lucide-react";
import { useCustoEstimadoEnvio } from "@/hooks/useCustoEstimadoEnvio";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);

export const LIMITE_CUSTO_BRL_DEFAULT = 100;

type Props = {
  telefones: string[];
  instanciaIds: string[];
  categoria: string | null;
  limiteBrl?: number;
};

export default function CustoEstimadoEnvio({ telefones, instanciaIds, categoria, limiteBrl = LIMITE_CUSTO_BRL_DEFAULT }: Props) {
  const est = useCustoEstimadoEnvio(telefones, instanciaIds, categoria);
  if (est.total === 0 || instanciaIds.length === 0 || !categoria) return null;

  const isMkt = est.categoria === "MARKETING";
  const acimaLimite = est.brl > limiteBrl;
  const cor = isMkt || acimaLimite
    ? "border-red-500/50 bg-red-500/5"
    : est.brl > limiteBrl * 0.5
    ? "border-amber-500/50 bg-amber-500/5"
    : "border-emerald-500/40 bg-emerald-500/5";

  return (
    <Card className={cor}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" />
          Custo estimado deste envio
          {est.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {est.total.toLocaleString("pt-BR")} destinatário(s) · Categoria: <strong>{est.categoria || "—"}</strong> ·
          {" "}Preço: {usd(est.precoUsd)}/conversa
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border bg-background p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Cobrados</div>
            <div className="text-2xl font-bold tabular-nums">{est.cobrados.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">
              {usd(est.usd)} <span className="mx-1">·</span> <strong>{brl(est.brl)}</strong>
            </div>
          </div>
          <div className="rounded-md border bg-background p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Grátis (janela 24h aberta)</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600">{est.gratis.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">sem cobrança da Meta</div>
          </div>
        </div>

        {acimaLimite && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>Envio acima do teto de {brl(limiteBrl)}.</strong> A confirmação exigirá digitar o valor exato em reais antes de disparar.
              Cada WABA da Meta gera cobrança automática ao atingir US$ 25 acumulados.
            </div>
          </div>
        )}

        {!acimaLimite && est.brl > 0 && (
          <div className="text-[11px] text-muted-foreground">
            ⚠️ Este valor será debitado no cartão da Meta. Cada WABA cobra ao acumular US$ 25.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
