import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { LancarAcordoConversa } from './LancarAcordoConversa';

const numeroBR = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export interface DadosLancamento { cpf: string; nome: string; telefone: string; total: number | null; parcelas: number | null; primeiroVencimento: string | null; observacao?: string }

export function LancarAcordoDialog({ open, onOpenChange, dados, conversaId, onTelaCompleta }: {
  open: boolean; onOpenChange: (v: boolean) => void; dados: DadosLancamento; conversaId?: string | null; onTelaCompleta: () => void;
}) {
  const [cpf, setCpf] = useState('');
  const [total, setTotal] = useState('');
  const [parcelas, setParcelas] = useState('');
  const [venc, setVenc] = useState('');

  useEffect(() => {
    if (!open) return;
    setCpf(dados.cpf.replace(/\D/g, ''));
    setTotal(dados.total ? dados.total.toFixed(2).replace('.', ',') : '');
    setParcelas(dados.parcelas ? String(dados.parcelas) : '');
    setVenc(dados.primeiroVencimento ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Lançar acordo desta negociação</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Confira os dados preenchidos, ajuste se precisar e salve o acordo.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))} /></div>
          <div className="space-y-1"><Label className="text-xs">Total do acordo</Label><Input value={total} onChange={(e) => setTotal(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Nº de parcelas</Label><Input value={parcelas} inputMode="numeric" onChange={(e) => setParcelas(e.target.value.replace(/\D/g, '').slice(0, 2))} /></div>
          <div className="space-y-1"><Label className="text-xs">1º vencimento</Label><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></div>
        </div>
        <LancarAcordoConversa
          cpf={cpf} nomeInicial={dados.nome} telefoneInicial={dados.telefone}
          total={Math.round(numeroBR(total) * 100) / 100} parcelas={parseInt(parcelas, 10) || 0} primeiroVencimento={venc}
          conversaId={conversaId} observacaoExtra={dados.observacao}
        />
        <Button variant="link" size="sm" className="self-start px-0" onClick={onTelaCompleta}>Abrir tela completa de novo acordo</Button>
      </DialogContent>
    </Dialog>
  );
}
