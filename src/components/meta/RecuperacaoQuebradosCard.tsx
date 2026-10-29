import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEnvioMetaSending } from '@/contexts/EnvioMetaSendingContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, LifeBuoy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { montarClientesRecuperacao, type ClienteRecuperacao, type ParcelaVencida } from '@/lib/recuperacaoQuebrados';

const TEMPLATE_PADRAO = 'abertura_para_reagendamento_de_pagamento';
const CUSTO_UTILITY_BRL = 0.04; // estimativa por mensagem Utility no Brasil

type Tpl = { id: string; nome_template: string; instancia_id: string; body_text: string | null };
type Inst = { id: string; nome: string };

const isoBRT = (offsetDias = 0) => {
  const d = new Date(Date.now() - 3 * 3600_000 + offsetDias * 86400_000);
  return d.toISOString().slice(0, 10);
};

export function RecuperacaoQuebradosCard() {
  const { user } = useAuth();
  const { iniciar } = useEnvioMetaSending();
  const [periodo, setPeriodo] = useState<'7' | 'mes'>('7');
  const [credor, setCredor] = useState<'ambos' | 'ume_novo_mundo' | 'odres_cred'>('ambos');
  const [clientes, setClientes] = useState<ClienteRecuperacao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [instancias, setInstancias] = useState<Inst[]>([]);
  const [tplNome, setTplNome] = useState(TEMPLATE_PADRAO);
  const [confirmar, setConfirmar] = useState(false);
  const [disparando, setDisparando] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: inst } = await supabase.from('meta_whatsapp_instances')
        .select('id,nome').eq('user_id', user.id).eq('ativo', true)
        .eq('saude_status', 'CONNECTED').eq('saude_quality', 'GREEN')
        .eq('estado_pool', 'ativo').eq('instancia_teste_aquecimento', false);
      const ids = (inst || []).map(i => i.id);
      setInstancias((inst || []) as Inst[]);
      if (!ids.length) return;
      const { data: tpl } = await supabase.from('meta_whatsapp_templates')
        .select('id,nome_template,instancia_id,body_text').in('instancia_id', ids)
        .eq('status', 'approved').ilike('categoria', 'UTILITY');
      setTemplates((tpl || []) as Tpl[]);
    })();
  }, [user]);

  const nomesTemplates = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) if (!m.has(t.nome_template) || (!m.get(t.nome_template) && t.body_text)) m.set(t.nome_template, t.body_text || '');
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  const tplRows = templates.filter(t => t.nome_template === tplNome);
  const corpo = nomesTemplates.find(([n]) => n === tplNome)?.[1] || '';

  async function carregar() {
    setCarregando(true); setClientes(null);
    try {
      const hoje = isoBRT(0);
      const inicio = periodo === '7' ? isoBRT(-7) : `${hoje.slice(0, 8)}01`;
      const empresas = credor === 'ambos' ? ['ume_novo_mundo', 'odres_cred'] : [credor];
      const rows: ParcelaVencida[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('pagamentos')
          .select('acordo_id,data_prevista,valor_parcela,acordos!inner(cliente_nome,cliente_telefone,cliente_cpf,empresa,status)')
          .eq('status', 'pendente').gte('data_prevista', inicio).lt('data_prevista', hoje)
          .eq('acordos.status', 'ativo').in('acordos.empresa', empresas)
          .order('data_prevista', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        for (const p of data || []) {
          const a: any = (p as any).acordos;
          rows.push({ acordo_id: p.acordo_id, data_prevista: p.data_prevista, valor_parcela: p.valor_parcela,
            cliente_nome: a?.cliente_nome, cliente_telefone: a?.cliente_telefone, cliente_cpf: a?.cliente_cpf, empresa: a?.empresa });
        }
        if (!data || data.length < 1000) break;
      }
      setClientes(montarClientesRecuperacao(rows));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar os clientes');
    } finally { setCarregando(false); }
  }

  const totalAberto = (clientes || []).reduce((s, c) => s + c.saldo, 0);
  const custo = (clientes?.length || 0) * CUSTO_UTILITY_BRL;
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  async function disparar() {
    if (!clientes?.length || !tplRows.length) return;
    setDisparando(true);
    const byInst: Record<string, string> = {};
    for (const t of tplRows) byInst[t.instancia_id] = t.id;
    const instIds = Object.keys(byInst);
    const jobId = await iniciar({
      template: { id: tplRows[0].id, nome_template: tplNome },
      instanciaIds: instIds,
      instancias: instancias.filter(i => byInst[i.id]),
      clientes: clientes.map(c => ({ telefone: c.telefone, nome: c.nome, cpf: c.cpf, saldo: c.saldo, vars: c.vars })),
      minSec: 3, maxSec: 8,
      templateIdByInstance: byInst,
      nomeCampanha: `Recuperação quebrados ${periodo === '7' ? '7 dias' : 'mês'} ${isoBRT(0)}`,
      validarNoEnvio: false,
    });
    setDisparando(false); setConfirmar(false);
    if (jobId) toast.success('Campanha de recuperação iniciada. Acompanhe no painel de envios.');
  }

  return (
    <section className="space-y-4 border-b pb-6" aria-labelledby="recuperacao-heading">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 id="recuperacao-heading" className="text-xl font-semibold flex items-center gap-2"><LifeBuoy className="h-5 w-5" />Recuperar acordos com parcela vencida</h2>
        <Badge variant="secondary">{instancias.length} números GREEN</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div><Label>Período</Label>
          <Select value={periodo} onValueChange={v => { setPeriodo(v as any); setClientes(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="mes">Mês atual inteiro</SelectItem></SelectContent>
          </Select></div>
        <div><Label>Credor</Label>
          <Select value={credor} onValueChange={v => { setCredor(v as any); setClientes(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ambos">UME + Odres Cred</SelectItem><SelectItem value="ume_novo_mundo">UME</SelectItem><SelectItem value="odres_cred">Odres Cred</SelectItem></SelectContent>
          </Select></div>
        <div><Label>Modelo aprovado (Utility)</Label>
          <Select value={tplNome} onValueChange={setTplNome}>
            <SelectTrigger><SelectValue placeholder="Escolha o modelo" /></SelectTrigger>
            <SelectContent>{nomesTemplates.map(([n]) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select></div>
      </div>
      {corpo && <div className="border-l-2 border-primary bg-muted/30 p-3 whitespace-pre-wrap text-sm">{corpo}</div>}
      <p className="text-xs text-muted-foreground">Variáveis automáticas: nome do cliente, credor e data da parcela vencida. Um envio por telefone; respostas caem no Inbox.</p>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={carregar} disabled={carregando}>{carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Buscar clientes</Button>
        <Button disabled={!clientes?.length || !tplRows.length} onClick={() => setConfirmar(true)}><Send className="h-4 w-4" />Disparar recuperação</Button>
      </div>
      {clientes && <p className="text-sm font-medium">{clientes.length} clientes · {brl(totalAberto)} em parcelas vencidas · {tplRows.length} números com o modelo</p>}
      {clientes && clientes.length > 0 && (
        <div className="max-h-60 overflow-auto divide-y text-sm">
          {clientes.slice(0, 50).map(c => <div key={c.telefone} className="py-1.5 flex justify-between gap-2"><span>{c.nome} · {c.credor}</span><span className="text-muted-foreground">venceu {c.vencimento} · {brl(c.saldo)}</span></div>)}
          {clientes.length > 50 && <p className="py-1.5 text-muted-foreground">+ {clientes.length - 50} clientes</p>}
        </div>
      )}
      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar campanha de recuperação</DialogTitle>
            <DialogDescription>Mensagens pagas pela Meta.</DialogDescription></DialogHeader>
          <p className="text-sm">{clientes?.length} mensagens com o modelo <b>{tplNome}</b>, distribuídas entre {tplRows.length} números GREEN, intervalo de 3 a 8 segundos.</p>
          <p className="text-sm">Custo estimado: <b>{brl(custo)}</b> (cobrança final pela Meta). Contatos que já receberam mensagem recentemente são ignorados automaticamente.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button disabled={disparando} onClick={disparar}>{disparando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Confirmar disparo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
