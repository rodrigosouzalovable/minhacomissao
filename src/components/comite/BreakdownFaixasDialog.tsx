import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TODAS_FAIXAS, useCarteira, useKpisExtras } from '@/hooks/useComiteNovoMundo';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const moeda = (v: number) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const pctFmt = (v: number) => `${((v || 0) * 100).toFixed(1)}%`;

export function BreakdownFaixasDialog({ trigger }: { trigger?: React.ReactNode }) {
  const carteira = useCarteira();
  const d = carteira.data;
  const mesAno = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; })();
  const extras = useKpisExtras(mesAno);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost">
            <Maximize2 className="h-3 w-3 mr-1" /> Detalhar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carteira Novo Mundo — Detalhamento por faixa</DialogTitle>
        </DialogHeader>

        {!d || d.totalContratos === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem dados de carteira. Importe a planilha para visualizar o detalhamento.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {d.snapshot?.arquivo_nome && (
                <>Arquivo: <b>{d.snapshot.arquivo_nome}</b> · </>
              )}
              {d.snapshot?.importado_em && (
                <>Importado em {new Date(d.snapshot.importado_em).toLocaleString('pt-BR')}</>
              )}
            </div>

            <div className="overflow-x-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2" rowSpan={2}>Faixa de atraso</th>
                    <th className="text-center p-2 border-l" colSpan={3}>INADIMPLENTES (NN)</th>
                    <th className="text-center p-2 border-l" colSpan={3}>APORTE (Colchão)</th>
                    <th className="text-center p-2 border-l" colSpan={3}>Total</th>
                    <th className="text-center p-2 border-l" rowSpan={2}>% Recup. mês</th>
                  </tr>
                  <tr>
                    <th className="text-right p-2 border-l">Contratos</th>
                    <th className="text-right p-2">CPFs</th>
                    <th className="text-right p-2">R$ risco</th>
                    <th className="text-right p-2 border-l">Contratos</th>
                    <th className="text-right p-2">CPFs</th>
                    <th className="text-right p-2">R$ risco</th>
                    <th className="text-right p-2 border-l">Contratos</th>
                    <th className="text-right p-2">CPFs</th>
                    <th className="text-right p-2">R$ risco</th>
                  </tr>
                </thead>
                <tbody>
                  {TODAS_FAIXAS.map((f) => {
                    const ina = d.matriz[f].INADIMPLENTES;
                    const apo = d.matriz[f].APORTE;
                    const totQ = ina.qtd + apo.qtd;
                    const totR = ina.risco + apo.risco;
                    const totCpfs = d.porFaixa[f].cpfsUnicos;
                    return (
                      <tr key={f} className="border-b">
                        <td className="p-2 font-medium">{f}</td>
                        <td className="p-2 text-right border-l">{ina.qtd.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right">{ina.cpfsUnicos.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right">{moeda(ina.risco)}</td>
                        <td className="p-2 text-right border-l">{apo.qtd.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right">{apo.cpfsUnicos.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right">{moeda(apo.risco)}</td>
                        <td className="p-2 text-right border-l font-medium">{totQ.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right font-medium">{totCpfs.toLocaleString('pt-BR')}</td>
                        <td className="p-2 text-right font-medium">{moeda(totR)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-muted/50">
                    <td className="p-2">Total</td>
                    <td className="p-2 text-right border-l">{d.porTipo.INADIMPLENTES.qtd.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{d.porTipo.INADIMPLENTES.cpfsUnicos.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{moeda(d.porTipo.INADIMPLENTES.risco)}</td>
                    <td className="p-2 text-right border-l">{d.porTipo.APORTE.qtd.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{d.porTipo.APORTE.cpfsUnicos.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{moeda(d.porTipo.APORTE.risco)}</td>
                    <td className="p-2 text-right border-l">{d.totalContratos.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{d.totalCpfsUnicos.toLocaleString('pt-BR')}</td>
                    <td className="p-2 text-right">{moeda(d.totalRisco)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
