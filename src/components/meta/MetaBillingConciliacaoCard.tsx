import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CreditCard, DollarSign, Loader2, RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { MetaBillingConciliacao } from "@/hooks/useMetaBillingConciliacao";

const usd = (v: number, digits = 2) =>
  `US$ ${(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const int = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v || 0));

type Props = {
  conciliacao: UseQueryResult<MetaBillingConciliacao, Error>;
};

export default function MetaBillingConciliacaoCard({ conciliacao }: Props) {
  const [syncing, setSyncing] = useState(false);
  const data = conciliacao.data;

  const sincronizarBilling = async () => {
    setSyncing(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("meta-billing-sync", {
        body: { days: 35 },
      });
      if (error) throw error;
      const erros = Array.isArray(resp?.errors) ? resp.errors.length : 0;
      if (erros) {
        toast.error(`Billing sincronizado com ${erros} alerta(s) da Meta`);
      } else {
        toast.success(`Billing sincronizado: ${resp?.upserted || 0} registro(s)`);
      }
      await conciliacao.refetch();
    } catch (e: any) {
      toast.error("Falha ao sincronizar billing: " + (e?.message || e));
    } finally {
      setSyncing(false);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "critico") return <Badge variant="destructive">Crítico</Badge>;
    if (status === "atencao") return <Badge variant="secondary">Atenção</Badge>;
    return <Badge variant="outline">OK</Badge>;
  };

  if (conciliacao.isLoading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando conciliação das faturas com o billing oficial...
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="mb-4 border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SearchX className="h-5 w-5" /> Conciliação Meta: fatura x consumo oficial
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Separa cobrança importada do cartão, custo oficial de conversas e divergência pendente de explicação.
            </p>
          </div>
          <Button variant="outline" onClick={sincronizarBilling} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar billing oficial
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-4 w-4" /> Faturas importadas do cartão
            </div>
            <div className="text-2xl font-bold mt-2">{usd(data.totais.faturasUsd)}</div>
            <div className="text-xs text-muted-foreground mt-1">PDFs importados manualmente</div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="h-4 w-4" /> Custo oficial por conversas
            </div>
            <div className="text-2xl font-bold mt-2">{usd(data.totais.oficialUsd, 4)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {int(data.totais.conversasCobradas)} cobradas · {brl(data.totais.oficialBrl)}
            </div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4" /> Diferença pendente
            </div>
            <div className="text-2xl font-bold mt-2">{usd(data.totais.diferencaUsd)}</div>
            <div className="text-xs text-muted-foreground mt-1">Fatura importada menos custo oficial</div>
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-start gap-2">
            {data.totais.marketingCobradas === 0 ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">Conclusão operacional</div>
              <p className="text-muted-foreground">
                O billing oficial sincronizado mostra {int(data.totais.utilityCobradas)} conversas UTILITY cobradas
                a preço médio de {usd(data.totais.precoMedioUtility, 4)} e {int(data.totais.marketingCobradas)} conversas MARKETING cobradas.
                A diferença relevante está nas faturas importadas, especialmente cobranças próximas de US$25 que não batem com o consumo da WABA atribuída.
              </p>
              {data.totais.ultimaDataSnapshot && (
                <p className="text-xs text-muted-foreground">Último dia no snapshot oficial: {new Date(data.totais.ultimaDataSnapshot + "T00:00:00").toLocaleDateString("pt-BR")}</p>
              )}
            </div>
          </div>
        </div>

        {data.alertas.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <div className="font-semibold text-sm mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Alertas de conciliação
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.alertas.map((a) => <li key={a}>• {a}</li>)}
            </ul>
          </div>
        )}

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instância</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Envios</TableHead>
                <TableHead className="text-right">Conversas oficiais</TableHead>
                <TableHead className="text-right">Custo oficial</TableHead>
                <TableHead className="text-right">Faturas</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.instancias.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.nome}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{r.wabaId || "sem WABA"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.displayPhone || "—"}</TableCell>
                  <TableCell className="text-right text-xs">
                    <div>{int(r.enviosSent)}</div>
                    {r.enviosSemPricing > 0 && <div className="text-muted-foreground">{int(r.enviosSemPricing)} sem pricing</div>}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <div>{int(r.conversasCobradas)} cobradas</div>
                    <div className="text-muted-foreground">{int(r.conversasGratis)} grátis</div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <div className="font-medium">{usd(r.oficialUsd, 4)}</div>
                    {r.marketingUsd > 0 && <div className="text-destructive">MKT {usd(r.marketingUsd, 2)}</div>}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <div className="font-medium">{usd(r.faturasUsd)}</div>
                    <div className="text-muted-foreground">{r.faturasCount} PDF(s)</div>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">{usd(r.diferencaUsd)}</TableCell>
                  <TableCell className="text-xs min-w-[220px]">
                    <div className="mb-1">{statusBadge(r.status)}</div>
                    <div className="text-muted-foreground">{r.motivo}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {(data.orfaos.length > 0 || data.templatesSemPricing.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.orfaos.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="font-semibold text-sm mb-2">WABAs órfãs no billing oficial</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {data.orfaos.slice(0, 8).map((o) => (
                    <div key={o.wabaId} className="flex justify-between gap-2">
                      <span className="font-mono">{o.wabaId}</span>
                      <span>{int(o.conversasSnapshot)} conv · {usd(o.oficialUsd, 4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.templatesSemPricing.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="font-semibold text-sm mb-2">Templates com envio sem pricing no log</div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {data.templatesSemPricing.slice(0, 8).map((t) => (
                    <div key={t.templateNome} className="flex justify-between gap-2">
                      <span className="font-mono truncate">{t.templateNome}</span>
                      <span>{int(t.qtd)} envio(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}