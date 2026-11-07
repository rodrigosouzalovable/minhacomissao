import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, ArrowUpRight, Check, ChevronDown, Loader2, QrCode, Zap } from 'lucide-react';
import PortalPixBox, { type PortalBoleto } from './PortalPixBox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CREDOR_MARCAS } from '@/lib/credorMarcas';
import { getDiasAtraso } from '@/lib/descontoPortal';
import { portalBrtToday, portalFifthBusinessDay, portalInstallments, portalMaxPaymentDate, portalNextPaymentDate, portalPaymentDateValid, portalProposalText, portalTerms, type PortalWallet } from '@/lib/portalNegotiation';
import { useContatoPortal } from '@/hooks/useContatoPortal';
import { portalDarkLogos } from './PortalShell';
import { supabase } from '@/integrations/supabase/client';
import PortalAcordoConcluido, { type PortalEfetivacao } from './PortalAcordoConcluido';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateLabel = (date: string) => date.split('-').reverse().join('/');
const maskTelefone = (v: string) => {
  let d = v.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const addMonths = (iso: string, n: number) => { const [y,m,d]=iso.split('-').map(Number); const last=new Date(Date.UTC(y,m-1+n+1,0)).getUTCDate(); const dt=new Date(Date.UTC(y,m-1+n,Math.min(d,last))); return dt.toISOString().slice(0,10); };
const telefoneOk = (v: string) => /^\(\d{2}\) 9\d{4}-\d{4}$/.test(v);

export default function PortalWalletSection({ wallet, cpf, retry }: { wallet: PortalWallet; cpf: string; retry: () => void }) {
  const [details, setDetails] = useState(false);
  const [mode, setMode] = useState<'avista' | 'parcelado' | null>(null);
  const [quantity, setQuantity] = useState(2);
  const [date, setDate] = useState('');
  const [entrada, setEntrada] = useState('');
  const contato = useContatoPortal();
  const marca = CREDOR_MARCAS[wallet.credor];
  const terms = wallet.principalValidado && wallet.principal != null ? portalTerms(wallet.principal, wallet.credor, getDiasAtraso(wallet.debitos), wallet.faixas) : null;
  const hasAgreement = wallet.acordos.length > 0;
  const entry = wallet.credor === 'novo_mundo' && mode === 'parcelado' ? Number(entrada || 0) : 0;
  const validEntry = Number.isFinite(entry) && (entry === 0 || entry >= 100) && entry < (terms?.total ?? 0);
  const total = mode === 'avista' ? terms?.avista ?? 0 : terms?.total ?? 0;
  const cap = wallet.credor === 'novo_mundo' ? 24 : 18;
  const max = Math.max(0, Math.min(cap, Math.floor(Math.round((total - entry) * 100) / 10000)));
  const installments = mode === 'parcelado' ? portalInstallments(total - entry, quantity, cap) : [];
  const lastInstallment = installments[installments.length - 1];
  const today = portalBrtToday();
  const maxDate = portalMaxPaymentDate(today);
  const quinto = portalFifthBusinessDay(today);
  const atalhos: [string, string][] = [[today, 'Hoje'], [portalNextPaymentDate(today), 'Amanhã'], ...(quinto ? [[quinto, '5º dia útil'] as [string, string]] : [])];
  useEffect(() => { setDate((d) => d || today); }, [today]);
  const valid = !!terms && !hasAgreement && !!mode && total > 0 && portalPaymentDateValid(date, today) && (mode === 'avista' ? wallet.credor !== 'novo_mundo' || total >= 100 : validEntry && installments.length >= 2);
  const whatsapp = `https://wa.me/${contato.phone}?text=${encodeURIComponent(valid && terms ? portalProposalText({credor:wallet.credor,nome:wallet.nome || 'Cliente',cpf,principal:terms.principal,total,installments,date,entrada:entry,contratos:[...new Set(wallet.debitos.map(d=>d.contrato).filter((c):c is string=>!!c))]}) : `Olá! Meu CPF é ${cpf}. Gostaria de consultar meu débito com ${marca.nome}.`)}`;
  const autoatendimento = wallet.credor !== 'novo_mundo';
  const [telefone, setTelefone] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<PortalEfetivacao | null>(null);
  const [revisando, setRevisando] = useState<'efetivar' | 'whatsapp' | null>(null);
  const [aceite, setAceite] = useState(false);
  const [pix, setPix] = useState<{ chave: string; loading: boolean; boleto?: PortalBoleto; atrasada?: boolean; erro?: string }>({ chave: '', loading: false });
  const gerarPix = async (acordoId: string, numeroParcela: number) => {
    const chave = `${acordoId}:${numeroParcela}`;
    setPix({ chave, loading: true });
    try {
      const { data, error } = await supabase.functions.invoke('portal-pix-parcela', { body: { cpf, credor: wallet.credor, acordoId, numeroParcela } });
      if (error) throw error;
      if (data?.success && data.boleto) setPix({ chave, loading: false, boleto: data.boleto, atrasada: !!data.atrasada });
      else setPix({ chave, loading: false, erro: data?.message || 'Não conseguimos gerar o PIX agora. Fale com nossa equipe.' });
    } catch { setPix({ chave, loading: false, erro: 'Não conseguimos gerar o PIX agora. Fale com nossa equipe.' }); }
  };
  const abrirRevisao = (t: 'efetivar' | 'whatsapp') => { setAceite(false); setRevisando(t); };
  const confirmar = async () => {
    if (!valid || enviando) return;
    setEnviando(true); setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('portal-efetivar-acordo', { body: { cpf, credor: wallet.credor, modo: mode, parcelas: mode === 'avista' ? 1 : quantity, primeiroVencimento: date, telefone } });
      if (error) throw error;
      setResultado(data as PortalEfetivacao);
    } catch {
      setResultado({ success: false, fallback: true, message: 'Não conseguimos concluir seu acordo automaticamente. Fale com nossa equipe no WhatsApp para formalizar esta proposta.' });
    } finally { setEnviando(false); }
  };

  if (resultado?.success) return <section className="portal-result-wallet py-9 border-b" aria-labelledby={`wallet-${wallet.credor}`}><PortalAcordoConcluido r={resultado} /></section>;

  return <section className="portal-result-wallet py-9 border-b" aria-labelledby={`wallet-${wallet.credor}`}>
    <div className="flex items-center justify-between gap-5 flex-wrap"><div className="flex items-center gap-4"><img src={portalDarkLogos[wallet.credor]} alt="" className={`portal-result-creditor portal-result-creditor-${wallet.credor}`} /><div><h2 id={`wallet-${wallet.credor}`} className="font-semibold text-xl">{marca.nome}</h2><p className="text-xs text-muted-foreground mt-1">{wallet.estado === 'loading' ? 'Consultando carteira' : hasAgreement ? 'Acordo disponível' : wallet.estado === 'empty' ? 'Nenhum débito localizado' : wallet.estado === 'error' ? 'Consulta temporariamente indisponível' : wallet.estado === 'pending' ? 'Consulte com nossa equipe' : 'Débito localizado'}</p></div></div>{wallet.estado === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}</div>
    {wallet.estado === 'loading' ? <p className="text-sm text-muted-foreground mt-6" role="status">Buscando suas informações...</p> : <>
      {wallet.mensagem && <div className="flex items-start gap-3 bg-muted rounded-lg p-4 mt-5"><AlertCircle className="w-5 h-5 shrink-0 text-muted-foreground" /><p className="text-sm text-muted-foreground leading-relaxed">{wallet.mensagem}</p></div>}
      {wallet.estado === 'error' && <Button variant="outline" className="mt-4" onClick={retry}>Tentar novamente</Button>}
      {wallet.credor === 'odres_cred' && wallet.estado !== 'error' && wallet.estado !== 'empty' && <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-4 mt-5"><Zap className="w-5 h-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong>Liberação rápida:</strong> pagando via PIX, o desbloqueio do seu telefone é liberado em até 2 horas após o pagamento.</p></div>}
      {wallet.estado === 'empty' && <p className="text-sm text-muted-foreground mt-5">Não encontramos débitos disponíveis nesta carteira para o CPF consultado.</p>}
      {hasAgreement ? <div className="mt-6 space-y-8">{wallet.acordos.map((acordo,index)=><div key={acordo.id}><h3 className="portal-agreement-summary text-sm font-semibold mb-5">Seu acordo{wallet.acordos.length > 1 ? ` ${index + 1}` : ''}: {acordo.parcelas.length} parcela{acordo.parcelas.length !== 1 ? 's' : ''} · Em andamento</h3>{acordo.parcelas.length === 0 ? <p className="text-sm text-muted-foreground">Fale com a equipe para conferir as parcelas deste acordo.</p> : <><p className="text-xs font-semibold text-muted-foreground mb-3">PARCELAS DO ACORDO</p><div className="space-y-2">{acordo.parcelas.map(p=><div key={p.numero_parcela} className={`portal-installment ${p.status === 'pago' ? 'is-paid' : ''} flex flex-wrap items-center justify-between gap-3 text-sm`}><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">Parcela {p.numero_parcela} de {acordo.parcelas.length}</span><span className={`portal-payment-badge ${p.status === 'pago' ? 'is-paid' : ''}`}>{p.status === 'pago' ? <><Check className="w-3 h-3" /> PAGO</> : 'PENDENTE'}</span></div><p className="text-xs text-muted-foreground mt-1">{p.status === 'pago' && p.data_paga ? `Pago em ${dateLabel(p.data_paga)}` : `Vencimento ${dateLabel(p.data_prevista)}`}</p></div><div className="text-right"><p className={`text-lg font-bold ${p.status === 'pago' ? 'text-primary' : ''}`}>{money(p.valor_parcela)}</p>{p.status !== 'pago' && autoatendimento && <Button size="sm" className="mt-2" disabled={pix.loading} onClick={()=>void gerarPix(acordo.id, p.numero_parcela)}>{pix.loading && pix.chave===`${acordo.id}:${p.numero_parcela}` ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <QrCode className="w-4 h-4 mr-1" />}{p.data_prevista < today ? 'Gerar PIX atualizado' : 'Gerar PIX'}</Button>}</div>{pix.chave===`${acordo.id}:${p.numero_parcela}` && !pix.loading && <div className="w-full mt-3">{pix.boleto ? <PortalPixBox b={pix.boleto} titulo={`PIX DA PARCELA ${p.numero_parcela}${pix.atrasada ? ' · VALOR ATUALIZADO' : ''}`} odres={wallet.credor==='odres_cred'} /> : <p className="text-sm text-destructive">{pix.erro}</p>}</div>}</div>)}</div><div className="portal-balance mt-5"><p className="text-xs text-muted-foreground font-semibold">SALDO RESTANTE</p><p className="mt-2 text-3xl font-bold">{money(acordo.parcelas.filter(p=>p.status!=='pago').reduce((s,p)=>s+Number(p.valor_parcela),0))}</p><p className="text-xs text-muted-foreground mt-2">{acordo.parcelas.filter(p=>p.status!=='pago').length} parcela(s) pendente(s)</p></div></>}</div>)}</div> : <>
        {wallet.principal != null && wallet.principal > 0 && <div className="mt-6"><p className="text-sm text-muted-foreground">{wallet.principalValidado ? 'Principal sem juros' : 'Valor registrado — base de negociação a confirmar'}</p><p className="text-3xl font-semibold mt-1">{money(wallet.principal)}</p></div>}
        {wallet.debitos.length > 0 && <div className="mt-4"><Button variant="ghost" onClick={()=>setDetails(v=>!v)} className="px-0 text-primary h-auto py-2" aria-expanded={details}>{details ? 'Ocultar detalhes' : `Ver detalhes (${wallet.debitos.length})`}<ChevronDown className={`w-4 h-4 ml-2 ${details?'rotate-180':''}`} /></Button>{details && <div className="divide-y mt-3">{wallet.debitos.map(d=><div key={d.id} className="py-3 flex justify-between gap-4 text-sm"><div><p>{d.contrato ? `Contrato ${d.contrato}` : 'Débito registrado'}</p>{d.data_vencimento && <p className="text-xs text-muted-foreground mt-1">Vencimento {dateLabel(d.data_vencimento)}</p>}{d.descricao && <p className="text-xs text-muted-foreground mt-1">{d.descricao}</p>}</div><p className="font-medium shrink-0">{money(d.valor_original)}</p></div>)}</div>}</div>}
        {terms && <div className="mt-7"><h3 className="font-semibold mb-4">Escolha uma condição</h3><div className="grid sm:grid-cols-2 gap-3"><Button variant={mode==='avista'?'default':'outline'} className="h-auto min-h-24 flex flex-col items-start p-5 whitespace-normal text-left" onClick={()=>setMode('avista')} disabled={wallet.credor==='novo_mundo' && terms.avista<100}><span className="text-sm">À vista{terms.avistaPct>0?` · ${terms.avistaPct}% de desconto`:''}</span><span className="text-2xl font-semibold mt-2">{money(terms.avista)}</span></Button><Button variant={mode==='parcelado'?'default':'outline'} className="h-auto min-h-24 flex flex-col items-start p-5 whitespace-normal text-left" onClick={()=>setMode('parcelado')} disabled={terms.maxParcelas<2}><span className="text-sm">Parcelado{terms.parceladoPct>0?` · ${terms.parceladoPct}% de desconto`:''}</span><span className="text-2xl font-semibold mt-2">{money(terms.total)}</span><span className="text-xs mt-1">{terms.maxParcelas>=2?`Até ${terms.maxParcelas}x · mínimo R$ 100`:'Parcelamento indisponível para este valor'}</span></Button></div>
          {mode && <div className="mt-6 space-y-5 border-t pt-6"><dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Principal</dt><dd>{money(terms.principal)}</dd></div>{mode==='parcelado' && wallet.credor!=='novo_mundo' && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Acréscimo de 10%</dt><dd>{money(terms.acrescimo)}</dd></div>}<div className="flex justify-between gap-4 font-semibold"><dt>{mode==='avista'?'Total à vista':'Total parcelado'}</dt><dd>{money(total)}</dd></div></dl>
            {mode==='parcelado' && <>{wallet.credor==='novo_mundo' && <div><Label htmlFor={`entrada-${wallet.credor}`}>Entrada opcional (mínimo R$ 100)</Label><Input id={`entrada-${wallet.credor}`} type="number" min="0" step="0.01" value={entrada} onChange={e=>setEntrada(e.target.value)} className="mt-2 max-w-xs" placeholder="0,00" />{!validEntry && <p className="text-xs text-destructive mt-2">Informe zero ou entrada de pelo menos R$ 100, inferior ao total.</p>}</div>}<div><Label htmlFor={`parcelas-${wallet.credor}`}>Quantidade de parcelas</Label><Select value={String(quantity)} onValueChange={v=>setQuantity(Number(v))}><SelectTrigger id={`parcelas-${wallet.credor}`} className="mt-2 max-w-sm"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{Array.from({length:Math.max(0,max-1)},(_,i)=>i+2).map(n=>{const values=portalInstallments(total-entry,n,cap);return <SelectItem key={n} value={String(n)}>{n}x{wallet.credor==='odres_cred'?' mensais':''} de {money(values[0] ?? 0)}</SelectItem>;})}</SelectContent></Select>{installments.length>0 && <p className="text-xs text-muted-foreground mt-2">{installments.length} parcelas {wallet.credor==='odres_cred' && <strong>mensais</strong>}{wallet.credor==='odres_cred'?' ':''}de {money(installments[0])}{lastInstallment!==installments[0]?`; última parcela de ${money(lastInstallment ?? 0)}`:'.'}</p>}{installments.length>0 && wallet.credor==='odres_cred' && <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-3 mt-3 max-w-xl"><CalendarDays className="w-5 h-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong>Pagamento mensal:</strong> as parcelas vencem uma vez por mês, sempre no mesmo dia do primeiro pagamento. Não é quinzenal.</p></div>}{installments.length===0 && <p className="text-xs text-destructive mt-2">Escolha uma quantidade válida, com todas as parcelas a partir de R$ 100.</p>}</div></>}
            <div><Label>{mode==='avista'?'Data do pagamento à vista':'Data do primeiro pagamento'}</Label><div className="flex gap-2 mt-2 flex-wrap">{atalhos.map(([d,rot])=><Button key={d} type="button" variant={date===d?'default':'outline'} onClick={()=>setDate(d)}>{rot} · {dateLabel(d)}</Button>)}</div><div className="mt-2 max-w-[220px]"><Label className="text-xs">Ou escolha outra data</Label><Input type="date" min={today} max={maxDate} value={date} onChange={e=>setDate(e.target.value)} /></div><p className="text-xs text-muted-foreground mt-2">Pagamento em até 10 dias, até {dateLabel(maxDate)}.</p>{wallet.credor === 'odres_cred' && <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-3 mt-3"><Zap className="w-5 h-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed"><strong>Liberação rápida:</strong> pagando via PIX, o desbloqueio do seu telefone é liberado em até 2 horas após o pagamento.</p></div>}</div>
            {autoatendimento && valid && <div><Label htmlFor={`tel-${wallet.credor}`}>Seu WhatsApp com DDD</Label><Input id={`tel-${wallet.credor}`} inputMode="tel" value={telefone} onChange={e=>setTelefone(maskTelefone(e.target.value))} className="mt-2 max-w-xs" placeholder="(62) 99999-9999" /></div>}
            {resultado?.fallback ? <div className="space-y-3"><div className="flex items-start gap-3 bg-muted rounded-lg p-4"><AlertCircle className="w-5 h-5 shrink-0 text-muted-foreground" /><p className="text-sm leading-relaxed">{resultado.message}</p></div><Button asChild className="h-auto min-h-12 whitespace-normal"><a href={whatsapp} target="_blank" rel="noopener noreferrer">Falar no WhatsApp para formalizar<ArrowUpRight className="w-4 h-4 ml-2 shrink-0" /></a></Button></div>
            : autoatendimento ? <>{resultado?.message && <p className="text-sm text-destructive">{resultado.message}</p>}<div className="flex flex-col sm:flex-row gap-3"><Button disabled={!valid || !telefoneOk(telefone) || enviando} onClick={()=>abrirRevisao('efetivar')} className="h-auto min-h-12 whitespace-normal">{enviando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Formalizando seu acordo...</> : valid ? 'Confirmar acordo e gerar PIX' : 'Escolha a condição e a data de pagamento'}</Button>{valid && <Button variant="outline" className="h-auto min-h-12 whitespace-normal" onClick={()=>abrirRevisao('whatsapp')}>Formalizar acordo no WhatsApp<ArrowUpRight className="w-4 h-4 ml-2 shrink-0" /></Button>}</div></>
            : <>{valid && <p className="flex items-center gap-2 text-sm text-primary"><Check className="w-4 h-4" />Proposta pronta para confirmar com a equipe.</p>}
            <Button disabled={!valid} onClick={()=>abrirRevisao('whatsapp')} className="h-auto min-h-12 whitespace-normal">{valid ? <>Solicitar esta condição no WhatsApp<ArrowUpRight className="w-4 h-4 ml-2 shrink-0" /></> : <span>Escolha a condição e a data de pagamento</span>}</Button></>}
          </div>}
        </div>}
      </>}
      {(hasAgreement || !terms) && wallet.estado !== 'error' && <Button asChild className="mt-6 w-full h-auto min-h-12 whitespace-normal font-semibold"><a href={whatsapp} target="_blank" rel="noopener noreferrer">Falar sobre {marca.nome}<ArrowUpRight className="w-4 h-4 ml-2" /></a></Button>}
      {terms && !autoatendimento && <p className="text-xs text-muted-foreground mt-5">Simulação sujeita à confirmação da equipe. O pedido não gera acordo nem boleto automaticamente.</p>}
      {terms && autoatendimento && <p className="text-xs text-muted-foreground mt-5">Ao confirmar, seu acordo é formalizado e o PIX da primeira parcela aparece nesta tela.</p>}
    </>}
      {revisando && mode && <Dialog open onOpenChange={(o)=>{ if(!o) setRevisando(null); }}><DialogContent className="max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Confira seu acordo</DialogTitle><DialogDescription>Leia com atenção antes de confirmar. {marca.nome}</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm"><div className="rounded-lg border border-primary/40 bg-primary/10 p-4 text-center"><p className="text-xs font-semibold text-muted-foreground">VOCÊ ESTÁ FECHANDO</p><p className="text-2xl font-bold mt-1">{mode==='avista' ? `À vista: ${money(total)}` : `${installments.length}x de ${money(installments[0] ?? 0)}`}</p>{mode==='parcelado' && lastInstallment!==installments[0] && <p className="text-xs mt-1">Última parcela de {money(lastInstallment ?? 0)}</p>}</div>
        <dl className="space-y-2">{entry>0 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Entrada</dt><dd>{money(entry)}</dd></div>}<div className="flex justify-between gap-4 font-semibold"><dt>Total do acordo</dt><dd>{money(total)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">{mode==='avista'?'Data do pagamento':'1º pagamento'}</dt><dd className="font-semibold">{dateLabel(date)}</dd></div>{telefone && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">WhatsApp</dt><dd>{telefone}</dd></div>}</dl>
        {mode==='parcelado' && installments.length>0 && <div><p className="text-xs font-semibold text-muted-foreground mb-2">VENCIMENTOS</p><div className="divide-y rounded-md border">{installments.map((v,i)=><div key={i} className="flex justify-between px-3 py-1.5"><span>Parcela {i+1} · {dateLabel(addMonths(date,i))}</span><span className="font-medium">{money(v)}</span></div>)}</div></div>}
        <label className="flex items-start gap-3 rounded-md bg-muted p-3 cursor-pointer"><Checkbox checked={aceite} onCheckedChange={(v)=>setAceite(v===true)} className="mt-0.5" /><span>Li e confirmo que estou fechando um acordo {mode==='avista' ? `à vista de ${money(total)}` : `de ${installments.length}x de ${money(installments[0] ?? 0)}`}, com {mode==='avista'?'pagamento':'1º pagamento'} em {dateLabel(date)}.</span></label></div>
      <DialogFooter className="gap-2"><Button variant="outline" onClick={()=>setRevisando(null)}>Voltar e alterar</Button><Button disabled={!aceite} onClick={()=>{ const t=revisando; setRevisando(null); if(t==='efetivar') void confirmar(); else window.open(whatsapp,'_blank','noopener,noreferrer'); }}>Confirmar acordo</Button></DialogFooter></DialogContent></Dialog>}
  </section>;
}