import { useState } from 'react';
import { CheckCircle2, Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PortalEfetivacao {
  success: boolean;
  fallback?: boolean;
  message?: string;
  nome?: string;
  credor?: string;
  total?: number;
  parcelas?: number[];
  primeiroVencimento?: string;
  boleto?: { valor: number | null; vencimento: string; pixCode: string; invoiceUrl: string; pixQrCodeUrl: string; barcode: string } | null;
}

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (d: string) => d.split('-').reverse().join('/');

export default function PortalAcordoConcluido({ r }: { r: PortalEfetivacao }) {
  const [copiado, setCopiado] = useState('');
  const copiar = async (texto: string, qual: string) => { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(''), 2500); };
  const p = r.parcelas ?? [];
  const b = r.boleto;
  return <div className="space-y-6">
    <div className="flex items-start gap-3"><CheckCircle2 className="w-7 h-7 text-primary shrink-0" /><div><h2 className="font-semibold text-xl">Acordo formalizado com {r.credor}!</h2><p className="text-sm text-muted-foreground mt-1">{p.length <= 1 ? `À vista: ${money(r.total ?? 0)}` : `${p.length}x de ${money(p[0])} — total ${money(r.total ?? 0)}`}. 1º vencimento em {br(r.primeiroVencimento ?? '')}.</p></div></div>
    {b?.pixCode ? <div className="portal-balance space-y-4">
      <p className="text-xs text-muted-foreground font-semibold">PIX DA 1ª PARCELA{b.valor ? ` · ${money(b.valor)}` : ''} · VENCE {br(b.vencimento)}</p>
      {/odres/i.test(r.credor ?? '') && <p className="text-sm font-medium text-primary">⚡ Copie o PIX abaixo e pague no seu banco: o desbloqueio do seu telefone é liberado em até 2 horas após o pagamento.</p>}
      {b.pixQrCodeUrl && <img src={b.pixQrCodeUrl} alt="QR Code PIX" className="w-48 h-48 bg-background rounded-md" />}
      <p className="text-xs break-all font-mono bg-muted rounded-md p-3">{b.pixCode}</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void copiar(b.pixCode, 'pix')}><Copy className="w-4 h-4 mr-2" />{copiado === 'pix' ? 'Copiado!' : 'Copiar código PIX'}</Button>
        {b.barcode && <Button variant="outline" onClick={() => void copiar(b.barcode, 'bar')}><Copy className="w-4 h-4 mr-2" />{copiado === 'bar' ? 'Copiado!' : 'Copiar código de barras'}</Button>}
        {b.invoiceUrl && <Button asChild variant="outline"><a href={b.invoiceUrl} target="_blank" rel="noopener noreferrer"><FileText className="w-4 h-4 mr-2" />Baixar boleto</a></Button>}
      </div>
    </div> : <p className="text-sm text-muted-foreground bg-muted rounded-lg p-4">Seu acordo foi registrado. Nossa equipe enviará o boleto da primeira parcela no seu WhatsApp em breve.</p>}
    <p className="text-xs text-muted-foreground">Guarde esta tela. Não é necessário nos enviar mensagem — já fomos avisados do seu acordo.</p>
  </div>;
}
