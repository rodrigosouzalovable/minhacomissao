import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Play, CheckCircle2, Barcode, Send } from 'lucide-react';
import { toast } from 'sonner';

const soDigitos = (v: string) => (v || '').replace(/\D/g, '');
const formatCpf = (d: string) => d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroBR = (v: string) => { const n = Number((v || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const fmtData = (iso: string) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };

interface Carregado {
  cliente: { borrowerId: string; nome: string | null; carteira: string; dataLote: string };
  parcelas: { installment_id: string; contrato: string | null; vencimento: string | null; valor: number | null }[];
  totalAberto: number;
}
interface Boleto { valor: number | null; vencimento: string; pixCode: string; invoiceUrl: string; ambiente: string }

/** Resumo legível das parcelas que a UME devolve (formato varia: tenta campos comuns). */
function resumoResultado(r: any): string {
  if (!r || typeof r !== 'object') return '';
  const lista = (Array.isArray(r) ? r : r.installments ?? r.payments ?? r.renegotiationInstallments ?? r.parcelas) as any[] | undefined;
  const linhas: string[] = [];
  const total = r.totalValue ?? r.total ?? r.renegotiationTotalValue;
  if (total != null) linhas.push(`Total: ${fmt(Number(total))}`);
  if (Array.isArray(lista)) {
    lista.slice(0, 30).forEach((p, i) => {
      const v = p.value ?? p.installmentValue ?? p.valor ?? p.amount;
      const d = p.dueDate ?? p.vencimento ?? p.paymentDueDate;
      linhas.push(`${i + 1}ª: ${v != null ? fmt(Number(v)) : '—'}${d ? ` em ${fmtData(String(d))}` : ''}`);
    });
  }
  return linhas.join('\n');
}

export function AcordoUmeApiDialog({ open, onOpenChange, cpfInicial, conversaId, onEnviar }: {
  open: boolean; onOpenChange: (v: boolean) => void; cpfInicial?: string | null; conversaId?: string | null; onEnviar?: (texto: string) => void;
}) {
  const [cpf, setCpf] = useState('');
  const [dados, setDados] = useState<Carregado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [nParcelas, setNParcelas] = useState('18');
  const [totalAcordo, setTotalAcordo] = useState('');
  const [primeiroVenc, setPrimeiroVenc] = useState('');
  const [juros, setJuros] = useState('0');
  const [simulacao, setSimulacao] = useState<any>(null);
  const [efetivado, setEfetivado] = useState<any>(null);
  const [ocupado, setOcupado] = useState<'' | 'simular' | 'efetivar' | 'boleto'>('');
  const [erro, setErro] = useState('');
  const [boleto, setBoleto] = useState<Boleto | null>(null);

  useEffect(() => {
    if (!open) return;
    const c = soDigitos(cpfInicial || '');
    setCpf(c); setDados(null); setSimulacao(null); setEfetivado(null); setBoleto(null); setErro('');
    if (c.length === 11) void carregar(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cpfInicial]);

  const chamar = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('ume-acordo-api', { body });
    if (error) throw error;
    if (!(data as any)?.success) throw new Error((data as any)?.message || (data as any)?.error || 'Falha');
    return data as any;
  };

  const carregar = async (c = cpf) => {
    if (soDigitos(c).length !== 11) { toast.error('Informe um CPF com 11 dígitos'); return; }
    setCarregando(true); setErro(''); setSimulacao(null);
    try {
      const r = await chamar({ acao: 'carregar', cpf: soDigitos(c) });
      setDados(r);
      if (!totalAcordo) setTotalAcordo(String(r.totalAberto).replace('.', ','));
    } catch (e) { setDados(null); setErro(String((e as Error)?.message || e)); }
    finally { setCarregando(false); }
  };

  const n = Math.round(numeroBR(nParcelas));
  const vTotal = numeroBR(totalAcordo);
  const desconto = dados ? round2(dados.totalAberto - vTotal) : 0;
  const parcela = n > 0 ? round2(vTotal / n) : 0;
  const pode = !!dados && n >= 1 && n <= 24 && vTotal > 0 && desconto >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(primeiroVenc) && parcela >= 100 || (!!dados && n === 1 && vTotal > 0 && desconto >= 0 && !!primeiroVenc);

  const executar = async (acao: 'simular' | 'efetivar') => {
    if (acao === 'efetivar' && !window.confirm(`Efetivar acordo REAL na UME: ${n}x de ${fmt(parcela)} (total ${fmt(vTotal)}), 1º vencimento ${fmtData(primeiroVenc)}?`)) return;
    setOcupado(acao); setErro('');
    try {
      const r = await chamar({ acao, cpf: soDigitos(cpf), numeroParcelas: n, primeiroVencimento: primeiroVenc, desconto, juros: numeroBR(juros), confirmar: acao === 'efetivar', conversaId: conversaId || null });
      if (acao === 'simular') { setSimulacao(r.resultado ?? {}); toast.success('Simulação da UME recebida — confira antes de efetivar'); }
      else { setEfetivado(r.resultado ?? {}); toast.success('Acordo efetivado na UME'); }
    } catch (e) { setErro(String((e as Error)?.message || e)); }
    finally { setOcupado(''); }
  };

  const gerarBoleto = async () => {
    setOcupado('boleto'); setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('ume-boleto', { body: { acao: 'gerar', cpf: soDigitos(cpf), vencimento: primeiroVenc, origem: 'atendente' } });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.message || (data as any)?.error || 'Falha ao gerar boleto');
      setBoleto((data as any).boleto);
    } catch (e) { setErro(String((e as Error)?.message || e)); }
    finally { setOcupado(''); }
  };

  const textoEnvio = () => {
    const nome = (dados?.cliente.nome || '').split(' ')[0];
    return [
      `Olá${nome ? `, ${nome}` : ''}! Seu acordo foi formalizado: *${n}x de ${fmt(parcela)}* (total ${fmt(vTotal)}).`,
      '', `📅 *1º vencimento:* ${fmtData(boleto?.vencimento || primeiroVenc)}`,
      boleto?.valor ? `💰 *Valor deste boleto:* ${fmt(boleto.valor)}` : null,
      boleto?.pixCode ? `\n🔑 *PIX copia e cola:*\n${boleto.pixCode}` : null,
      boleto?.invoiceUrl ? `\n📄 *Boleto (PDF):* ${boleto.invoiceUrl}` : null,
      '', 'Qualquer dúvida, estou à disposição!',
    ].filter((l) => l !== null).join('\n');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Acordo parcelado UME / Odres (API oficial)</DialogTitle></DialogHeader>

        <div className="flex gap-2">
          <Input value={formatCpf(soDigitos(cpf))} onChange={(e) => setCpf(soDigitos(e.target.value).slice(0, 11))} className="max-w-[190px]" placeholder="000.000.000-00" />
          <Button variant="outline" onClick={() => void carregar()} disabled={carregando}>
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-2">Buscar parcelas</span>
          </Button>
        </div>

        {erro && <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm whitespace-pre-wrap">{erro}</div>}

        {dados && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Nome</div><div className="font-medium">{dados.cliente.nome || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">ID UME</div><div className="font-medium">{dados.cliente.borrowerId}</div></div>
              <div><div className="text-xs text-muted-foreground">Parcelas em aberto</div><div className="font-medium">{dados.parcelas.length}</div></div>
              <div><div className="text-xs text-muted-foreground">Total em aberto</div><div className="font-medium">{fmt(dados.totalAberto)}</div></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Base do arquivo de {fmtData(dados.cliente.dataLote)}.</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label className="text-xs">Total do acordo</Label><Input value={totalAcordo} onChange={(e) => setTotalAcordo(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Nº de parcelas</Label><Input value={nParcelas} onChange={(e) => setNParcelas(e.target.value.replace(/\D/g, '').slice(0, 2))} /></div>
              <div className="space-y-1"><Label className="text-xs">1º vencimento</Label><Input type="date" value={primeiroVenc} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPrimeiroVenc(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Juros (% a.m.)</Label><Input value={juros} onChange={(e) => setJuros(e.target.value)} /></div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Parcela: {fmt(parcela)}</Badge>
              <Badge variant="secondary">Desconto: {fmt(desconto)}</Badge>
            </div>
            {desconto < 0 && <p className="text-xs text-destructive">O total do acordo está acima do total em aberto. Para cobrar acréscimo, use o campo de juros e confira na simulação.</p>}
            {n > 1 && parcela > 0 && parcela < 100 && <p className="text-xs text-destructive">Parcela mínima é R$ 100.</p>}

            {simulacao && (
              <div className="space-y-1 rounded border p-3 text-sm">
                <div className="font-medium">Simulação devolvida pela UME</div>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{resumoResultado(simulacao) || JSON.stringify(simulacao, null, 2).slice(0, 2000)}</pre>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void executar('simular')} disabled={!pode || !!ocupado || !!efetivado}>
                {ocupado === 'simular' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Simular na UME
              </Button>
              <Button onClick={() => void executar('efetivar')} disabled={!simulacao || !!ocupado || !!efetivado}>
                {ocupado === 'efetivar' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} {efetivado ? 'Acordo efetivado' : 'Efetivar acordo'}
              </Button>
            </div>

            {efetivado && (
              <div className="space-y-2 rounded border p-3 text-sm">
                <div className="font-medium">Acordo registrado na UME</div>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{resumoResultado(efetivado) || JSON.stringify(efetivado, null, 2).slice(0, 1500)}</pre>
                <Button size="sm" variant="outline" onClick={() => void gerarBoleto()} disabled={!!ocupado}>
                  {ocupado === 'boleto' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Barcode className="mr-2 h-4 w-4" />} Gerar boleto + PIX da 1ª parcela
                </Button>
                {boleto && <div className="text-xs">Boleto: {fmt(boleto.valor)} — venc. {fmtData(boleto.vencimento)}{boleto.ambiente === 'dev' ? ' (ambiente de testes)' : ''}</div>}
                {onEnviar && (
                  <Button size="sm" onClick={() => { onEnviar(textoEnvio()); onOpenChange(false); }}>
                    <Send className="mr-2 h-4 w-4" /> Enviar na conversa
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Nada é efetivado sem simular e confirmar. Cada simulação e acordo fica registrado com seu usuário.</p>
      </DialogContent>
    </Dialog>
  );
}
