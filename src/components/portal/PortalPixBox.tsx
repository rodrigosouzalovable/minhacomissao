import { useState } from 'react';
import { Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PortalBoleto { valor: number | null; vencimento: string; pixCode: string; invoiceUrl: string; pixQrCodeUrl: string; barcode: string }

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (d: string) => d.split('-').reverse().join('/');

export default function PortalPixBox({ b, titulo, odres }: { b: PortalBoleto; titulo: string; odres?: boolean }) {
  const [copiado, setCopiado] = useState('');
  const copiar = async (texto: string, qual: string) => { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(''), 2500); };
  return <div className="portal-balance space-y-4">
    <p className="text-xs text-muted-foreground font-semibold">{titulo}{b.valor ? ` · ${money(b.valor)}` : ''} · VENCE {br(b.vencimento)}</p>
    {odres && <p className="text-sm font-medium text-primary">⚡ Copie o PIX abaixo e pague no seu banco: o desbloqueio do seu telefone é liberado em até 2 horas após o pagamento.</p>}
    {b.pixQrCodeUrl && <img src={b.pixQrCodeUrl} alt="QR Code PIX" className="w-48 h-48 bg-background rounded-md" />}
    {b.pixCode && <p className="text-xs break-all font-mono bg-muted rounded-md p-3">{b.pixCode}</p>}
    <div className="flex flex-wrap gap-3">
      {b.pixCode && <Button onClick={() => void copiar(b.pixCode, 'pix')}><Copy className="w-4 h-4 mr-2" />{copiado === 'pix' ? 'Copiado!' : 'Copiar código PIX'}</Button>}
      {b.barcode && <Button variant="outline" onClick={() => void copiar(b.barcode, 'bar')}><Copy className="w-4 h-4 mr-2" />{copiado === 'bar' ? 'Copiado!' : 'Copiar código de barras'}</Button>}
      {b.invoiceUrl && <Button asChild variant="outline"><a href={b.invoiceUrl} target="_blank" rel="noopener noreferrer"><FileText className="w-4 h-4 mr-2" />Baixar boleto</a></Button>}
    </div>
  </div>;
}
