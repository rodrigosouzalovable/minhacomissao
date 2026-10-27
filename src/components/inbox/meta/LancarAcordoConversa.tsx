import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FilePlus2, Send } from 'lucide-react';
import { FormalizarTermoDialog } from '@/components/acordos/FormalizarTermoDialog';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { calcularPercentualComissaoMundoDaModa } from '@/lib/comissao';
import { useUserRole } from '@/hooks/useUserRole';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface MetaOrigemLanc { contatoId: string; instanciaId: string; telefone?: string | null; bsuid?: string | null; contatoNome?: string | null }
export interface EstadoLancamento { nome: string; telefone: string; dias: string; empresa: Empresa | null; operadorId: string | null }

type Empresa = 'ume_novo_mundo' | 'mundo_da_moda' | 'odres_cred';
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** (00) 00000-0000, sem o 55 do país. */
export function formatarTelefoneBr(valor: string | null | undefined): string {
  let d = String(valor ?? '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Soma meses mantendo o dia (limitado ao fim do mês), sem fuso horário. */
export function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export function LancarAcordoConversa({ cpf, nomeInicial, telefoneInicial, total, parcelas, primeiroVencimento, conversaId, credorInicial, observacaoExtra, onEstado, metaOrigem }: {
  metaOrigem?: MetaOrigemLanc | null;
  cpf: string; nomeInicial: string; telefoneInicial: string; total: number; parcelas: number; primeiroVencimento: string;
  conversaId?: string | null; credorInicial?: Empresa | null; observacaoExtra?: string; onEstado?: (e: EstadoLancamento) => void;
}) {
  const { isAdmin } = useUserRole();
  const [operadorId, setOperadorId] = useState<string | null>(null);
  const [operadores, setOperadores] = useState<Array<{ id: string; nome: string | null; email: string | null }>>([]);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setOperadorId((o) => o ?? data.user?.id ?? null)); }, []);
  useEffect(() => {
    if (!isAdmin) return;
    void supabase.from('profiles').select('id, nome, email').eq('ativo', true).order('nome').then(({ data }) => setOperadores((data as any) || []));
  }, [isAdmin]);
  const qc = useQueryClient();
  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState(telefoneInicial);
  const [dias, setDias] = useState('');
  const [empresa, setEmpresa] = useState<Empresa | null>(credorInicial ?? null);
  const [telOk, setTelOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [lancadoId, setLancadoId] = useState<string | null>(null);

  const [termo, setTermo] = useState<{ acordo: Tables<'acordos'>; pagamentos: Tables<'pagamentos'>[] } | null>(null);
  const [termoOpen, setTermoOpen] = useState(false);
  const [termoKey, setTermoKey] = useState(0);
  const [termoOk, setTermoOk] = useState(false);
  const [carregandoTermo, setCarregandoTermo] = useState(false);
  const abrirTermo = async () => {
    if (!lancadoId) return;
    setCarregandoTermo(true);
    try {
      const [{ data: a, error: e1 }, { data: p, error: e2 }] = await Promise.all([
        supabase.from('acordos').select('*').eq('id', lancadoId).single(),
        supabase.from('pagamentos').select('*').eq('acordo_id', lancadoId).order('numero_parcela'),
      ]);
      if (e1 || e2 || !a) throw e1 || e2 || new Error('Acordo não encontrado');
      setTermo({ acordo: a, pagamentos: p || [] }); setTermoKey((k) => k + 1); setTermoOpen(true);
    } catch (e) { toast.error(String((e as Error)?.message || e)); } finally { setCarregandoTermo(false); }
  };
  const [vencBase, setVencBase] = useState<string | null>(null);

  useEffect(() => { setNome((nomeInicial || '').toUpperCase()); }, [nomeInicial]);
  useEffect(() => { setTelefone(formatarTelefoneBr(telefoneInicial)); }, [telefoneInicial]);
  // Nome real cadastrado para o CPF (carteira/devedores) substitui o nome do perfil do WhatsApp.
  useEffect(() => {
    const c = cpf.replace(/\D/g, '');
    if (c.length !== 11) return;
    let ativo = true;
    void (async () => {
      const { data } = await (supabase.rpc as any)('nome_cliente_por_cpf', { p_cpf: c });
      if (ativo && typeof data === 'string' && data.trim()) setNome(data.trim().toUpperCase());
    })();
    return () => { ativo = false; };
  }, [cpf]);
  useEffect(() => { if (credorInicial) setEmpresa((e) => e ?? credorInicial); }, [credorInicial]);
  // Dias de atraso: parcela em aberto mais antiga da carteira UME/Odres (SFTP).
  useEffect(() => {
    const c = cpf.replace(/\D/g, '');
    setVencBase(null);
    if (c.length !== 11) return;
    let ativo = true;
    void (async () => {
      const { data } = await (supabase.rpc as any)('ume_vencimento_mais_antigo', { p_cpf: c });
      const v = data as string | null;
      if (!ativo || !v) return;
      const [y, m, d] = v.slice(0, 10).split('-').map(Number);
      const hoje = new Date(); const diasCalc = Math.floor((Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - Date.UTC(y, m - 1, d)) / 86400000);
      if (diasCalc > 0) { setVencBase(v.slice(0, 10)); setDias((atual) => atual || String(diasCalc)); }
    })();
    return () => { ativo = false; };
  }, [cpf]);


  useEffect(() => { onEstado?.({ nome, telefone, dias, empresa, operadorId }); }, [nome, telefone, dias, empresa, operadorId, onEstado]);

  const diasN = parseInt(dias, 10);
  const centavos = Math.round(total * 100);
  const base = parcelas > 0 ? Math.floor(centavos / parcelas) : 0;
  const valores = Array.from({ length: parcelas }, (_, i) => (i === parcelas - 1 ? centavos - base * (parcelas - 1) : base) / 100);
  const percentual = Number.isFinite(diasN) && diasN > 0 ? calcularPercentualComissaoMundoDaModa(diasN) : 0;
  const telDig = telefone.replace(/\D/g, '');
  const pode = nome.trim().length >= 3 && telDig.length >= 10 && Number.isFinite(diasN) && diasN > 0 && !!empresa
    && telOk && parcelas >= 1 && total > 0 && /^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento) && !lancadoId;

  const lancar = async () => {
    if (!pode || !empresa) return;
    if (!window.confirm(`Lançar acordo de ${nome.trim()}: ${parcelas}x, total ${fmt(total)}, ${diasN} dias de atraso?`)) return;
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada');
      const pags = valores.map((v, i) => ({
        numero_parcela: i + 1, data_prevista: somarMeses(primeiroVencimento, i), valor_parcela: v,
        comissao_parcela: round2(v * percentual / 100), status: 'pendente' as const,
      }));
      const { data: acordo, error } = await supabase.from('acordos').insert({
        user_id: isAdmin && operadorId ? operadorId : user.id, cliente_nome: nome.trim().toUpperCase(), cliente_cpf: cpf, cliente_telefone: telDig,
        valor_total: round2(total), parcelas, valor_parcela: valores[0], data_primeiro_pagamento: primeiroVencimento,
        dias_atraso: diasN, percentual_comissao: percentual,
        comissao_total: round2(pags.reduce((s, p) => s + p.comissao_parcela, 0)),
        observacoes: ['Acordo lançado pela conversa (Inbox)', observacaoExtra].filter(Boolean).join(' — '),
        empresa, telefone_confirmado_em: new Date().toISOString(), telefone_confirmado_por: user.id,
        termo_formalizacao_status: 'pendente', termo_meta_contato_id: conversaId ?? null,
      } as any).select('id').single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('pagamentos').insert(pags.map((p) => ({ ...p, acordo_id: acordo.id })));
      if (e2) throw e2;
      setLancadoId(acordo.id);
      void qc.invalidateQueries();
      toast.success('Acordo lançado em Meus Acordos');
    } catch (e) {
      toast.error(String((e as Error)?.message || e));
    } finally { setSalvando(false); }
  };

  const credores: [Empresa, string][] = [['mundo_da_moda', 'UME'], ['odres_cred', 'Odres Cred'], ['ume_novo_mundo', 'Novo Mundo']];

  return (
    <div className="space-y-3 rounded border p-3 text-sm">
      <div className="font-medium">Dados do acordo (Meus Acordos)</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Nome do cliente</Label><Input value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} /></div>
        <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input value={telefone} placeholder="(00) 00000-0000" maxLength={15} onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))} /></div>
        <div className="space-y-1"><Label className="text-xs">Dias de atraso</Label><Input value={dias} inputMode="numeric" onChange={(e) => setDias(e.target.value.replace(/\D/g, '').slice(0, 5))} /></div>
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Credor</Label>
          <div className="flex gap-2">{credores.map(([k, l]) => (
            <Button key={k} type="button" size="sm" variant={empresa === k ? 'default' : 'outline'} onClick={() => setEmpresa(k)}>{l}</Button>
          ))}</div>
        </div>
        {isAdmin && (
          <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Operador vinculado</Label>
            <Select value={operadorId ?? ''} onValueChange={setOperadorId}>
              <SelectTrigger><SelectValue placeholder="Selecione o operador" /></SelectTrigger>
              <SelectContent>{operadores.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome || o.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {parcelas}x — {parcelas > 1 && valores[parcelas - 1] !== valores[0] ? `${parcelas - 1}x de ${fmt(valores[0])} + última de ${fmt(valores[parcelas - 1])}` : fmt(valores[0] ?? 0)} · total {fmt(total)}
        {percentual > 0 && <> · comissão {percentual}%</>}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox checked={telOk} onCheckedChange={(v) => setTelOk(!!v)} /> Confirmei que este telefone é do cliente
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => void lancar()} disabled={!pode || salvando}>
          {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
          {lancadoId ? 'Acordo salvo' : 'Salvar acordo'}
        </Button>
        {lancadoId && (termoOk
          ? <p className="text-xs text-muted-foreground">Termo de acordo formalizado.</p>
          : <Button size="sm" variant="secondary" onClick={() => void abrirTermo()} disabled={carregandoTermo}>
              {carregandoTermo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar termo de acordo na conversa
            </Button>)}
      </div>
      {termo && <FormalizarTermoDialog key={termoKey} open={termoOpen} acordo={termo.acordo} pagamentos={termo.pagamentos}
        metaOrigem={metaOrigem ? { ...metaOrigem, instanciaNome: 'WhatsApp Oficial' } : null}
        onComplete={() => { setTermoOpen(false); setTermoOk(true); }} />}
    </div>
  );
}
