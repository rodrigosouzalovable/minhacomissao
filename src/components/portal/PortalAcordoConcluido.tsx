import { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PortalPixBox, { type PortalBoleto } from './PortalPixBox';

export interface PortalEfetivacao {
  success: boolean;
  fallback?: boolean;
  message?: string;
  nome?: string;
  credor?: string;
  total?: number;
  parcelas?: number[];
  primeiroVencimento?: string;
  boleto?: PortalBoleto | null;
}

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (d: string) => d.split('-').reverse().join('/');
const addMonths = (iso: string, n: number) => { const [y,m,d]=iso.split('-').map(Number); const last=new Date(Date.UTC(y,m-1+n+1,0)).getUTCDate(); return new Date(Date.UTC(y,m-1+n,Math.min(d,last))).toISOString().slice(0,10); };

export default function PortalAcordoConcluido({ r }: { r: PortalEfetivacao }) {
  const [aberto, setAberto] = useState(true);
  const p = r.parcelas ?? [];
  const b = r.boleto;
  const inicio = r.primeiroVencimento ?? '';
  return <div className="space-y-6">
    <div className="flex items-start gap-3"><CheckCircle2 className="w-7 h-7 text-primary shrink-0" /><div><h2 className="font-semibold text-xl">Acordo formalizado com {r.credor}!</h2><p className="text-sm text-muted-foreground mt-1">{p.length <= 1 ? `À vista: ${money(r.total ?? 0)}` : `${p.length}x de ${money(p[0])} — total ${money(r.total ?? 0)}`}. 1º vencimento em {br(inicio)}.</p></div></div>
    {b?.pixCode ? <PortalPixBox b={b} titulo="PIX DA 1ª PARCELA" odres={/odres/i.test(r.credor ?? '')} /> : <p className="text-sm text-muted-foreground bg-muted rounded-lg p-4">Seu acordo foi registrado. Nossa equipe enviará o boleto da primeira parcela no seu WhatsApp em breve.</p>}
    {p.length > 0 && inicio && <div>
      <Button variant="outline" className="w-full justify-between" onClick={() => setAberto(v => !v)} aria-expanded={aberto}>{aberto ? 'Ocultar acordo completo' : 'Ver acordo completo'}<ChevronDown className={`w-4 h-4 ${aberto ? 'rotate-180' : ''}`} /></Button>
      {aberto && <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">PARCELAS DO ACORDO{p.length > 1 ? ' · MENSAIS' : ''}</p>
        {p.map((v, i) => <div key={i} className="portal-installment flex flex-wrap items-center justify-between gap-3 text-sm"><div><span className="font-semibold">Parcela {i + 1} de {p.length}</span><p className="text-xs text-muted-foreground mt-1">Vencimento {br(addMonths(inicio, i))}{i === 0 ? ' · pague com o PIX acima' : ''}</p></div><p className="text-lg font-bold">{money(v)}</p></div>)}
        <div className="portal-balance mt-3"><p className="text-xs text-muted-foreground font-semibold">TOTAL DO ACORDO</p><p className="mt-2 text-3xl font-bold">{money(r.total ?? p.reduce((s, v) => s + v, 0))}</p></div>
        <p className="text-xs text-muted-foreground">Para pagar as próximas parcelas, consulte seu CPF novamente neste portal e toque em "Gerar PIX" na parcela.</p>
      </div>}
    </div>}
    <p className="text-xs text-muted-foreground">Guarde esta tela. Não é necessário nos enviar mensagem — já fomos avisados do seu acordo.</p>
  </div>;
}
