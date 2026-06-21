import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Loader2 } from "lucide-react";
import { CustoJanela, useMetaWhatsAppCusto } from "@/hooks/useMetaWhatsAppCusto";
import { forwardRef, useImperativeHandle } from "react";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function Coluna({ titulo, dados }: { titulo: string; dados: CustoJanela }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{titulo}</div>
      <div className="text-2xl font-bold tabular-nums">{brl(dados.valor)}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">
        {dados.qtdUtility.toLocaleString("pt-BR")} utilidade · {dados.qtdMarketing.toLocaleString("pt-BR")} marketing
        {dados.qtdOutros > 0 && ` · ${dados.qtdOutros} outros`}
      </div>
    </div>
  );
}

export type CustoEnvioCardHandle = { refetch: () => void };

const CustoEnvioCard = forwardRef<CustoEnvioCardHandle>((_, ref) => {
  const { hoje, mes, total, loading, refetch } = useMetaWhatsAppCusto();
  useImperativeHandle(ref, () => ({ refetch }), [refetch]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Custo de envios (Meta)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Utilidade/Auth: R$ 0,05 · Marketing: R$ 0,35<br />
                      Calculado sobre mensagens enviadas com sucesso.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription>Atualiza automaticamente a cada 30s e após cada disparo.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Coluna titulo="Hoje" dados={hoje} />
          <Coluna titulo="Este mês" dados={mes} />
          <Coluna titulo="Total" dados={total} />
        </div>
      </CardContent>
    </Card>
  );
});

CustoEnvioCard.displayName = "CustoEnvioCard";
export default CustoEnvioCard;
