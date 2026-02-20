import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, FileText, Phone, Download, DollarSign, User, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import logoSouzaRibeiro from '@/assets/logo-souza-ribeiro.png';
import { TelefoneTab } from '@/components/devedor/TelefoneTab';
import { CalculadoraDebitoDialog } from '@/components/devedor/CalculadoraDebitoDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Devedor {
  id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  credor: string | null;
  contrato: string | null;
  valor_original: number;
  valor_atualizado: number;
  data_vencimento: string | null;
  descricao: string | null;
  estagio: string;
}

interface Evento {
  id: string;
  tipo: string;
  descricao: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  criado_por: string;
  criado_em: string;
}

interface Telefone {
  id: string;
  numero: string;
  tipo: string;
  is_contato: boolean;
  is_whatsapp: boolean;
  ativo: boolean;
  autorizado: boolean;
  observacao: string | null;
  ramal: string | null;
}

export default function DevedorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [devedor, setDevedor] = useState<Devedor | null>(null);
  const [contratos, setContratos] = useState<Devedor[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [telefones, setTelefones] = useState<Telefone[]>([]);
  const [loading, setLoading] = useState(true);
  const [openContratos, setOpenContratos] = useState<Record<string, boolean>>({});
  const [cpfNorm, setCpfNorm] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventoTipo, setEventoTipo] = useState('contato_cliente');
  const [eventoDescricao, setEventoDescricao] = useState('');
  const [eventoFile, setEventoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit evento state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEventoId, setEditEventoId] = useState<string | null>(null);
  const [editEventoTipo, setEditEventoTipo] = useState('contato_cliente');
  const [editEventoDescricao, setEditEventoDescricao] = useState('');
  const [telefonesDialogOpen, setTelefonesDialogOpen] = useState(false);
  const [operadorNomes, setOperadorNomes] = useState<Record<string, string>>({});

  // Notificação Extrajudicial state
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const [notifContent, setNotifContent] = useState('');
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: dev } = await supabase
      .from('devedores')
      .select('id, nome, cpf, telefone, credor, contrato, valor_original, valor_atualizado, data_vencimento, descricao, estagio')
      .eq('id', id)
      .eq('ativo', true)
      .single();

    if (!dev) { setLoading(false); return; }
    setDevedor(dev as Devedor);

    const normCpf = (dev as any).cpf?.replace(/\D/g, '') || '';
    setCpfNorm(normCpf);

    if (normCpf) {
      // Check if this CPF belongs to a business group
      let allCpfs = [normCpf];
      const { data: grupoMembro } = await supabase
        .from('grupo_empresarial_membros' as any)
        .select('grupo_id')
        .eq('cpf_cnpj', normCpf)
        .limit(1);

      if (grupoMembro && (grupoMembro as any[]).length > 0) {
        const grupoId = (grupoMembro as any[])[0].grupo_id;
        const { data: allMembros } = await supabase
          .from('grupo_empresarial_membros' as any)
          .select('cpf_cnpj')
          .eq('grupo_id', grupoId);
        if (allMembros) {
          allCpfs = (allMembros as any[]).map(m => m.cpf_cnpj);
        }
      }

      // Contracts for all CPFs in the group
      const { data: ctrs } = await supabase
        .from('devedores')
        .select('id, nome, cpf, telefone, credor, contrato, valor_original, valor_atualizado, data_vencimento, descricao, estagio')
        .eq('ativo', true)
        .order('criado_em', { ascending: false });
      if (ctrs) setContratos((ctrs as Devedor[]).filter(c => allCpfs.includes(c.cpf.replace(/\D/g, ''))));

      // Phones for all CPFs in the group
      const allPhones: Telefone[] = [];
      for (const cpfItem of allCpfs) {
        const { data: phones } = await supabase
          .from('devedor_telefones' as any)
          .select('*')
          .eq('devedor_cpf', cpfItem);
        if (phones) allPhones.push(...(phones as unknown as Telefone[]));
      }
      setTelefones(allPhones);
    }

    // Events
    const { data: evts } = await supabase
      .from('devedor_eventos' as any)
      .select('*')
      .eq('devedor_id', id)
      .order('criado_em', { ascending: false });
    if (evts) {
      const eventosData = evts as unknown as Evento[];
      setEventos(eventosData);
      // Fetch operator names
      const uniqueIds = [...new Set(eventosData.map(e => e.criado_por))];
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome')
          .in('id', uniqueIds);
        if (profiles) {
          const nomes: Record<string, string> = {};
          profiles.forEach((p: any) => { nomes[p.id] = p.nome; });
          setOperadorNomes(nomes);
        }
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveEvento = async () => {
    if (!user || !id) return;
    setSaving(true);
    let arquivo_url: string | null = null;
    let arquivo_nome: string | null = null;

    if (eventoTipo === 'anexar_arquivo' && eventoFile) {
      const filePath = `${id}/${Date.now()}-${eventoFile.name}`;
      const { error: uploadError } = await supabase.storage.from('devedor-arquivos').upload(filePath, eventoFile);
      if (uploadError) { toast.error('Erro no upload: ' + uploadError.message); setSaving(false); return; }
      arquivo_url = filePath;
      arquivo_nome = eventoFile.name;
    }

    const { error } = await supabase.from('devedor_eventos' as any).insert({
      devedor_id: id, tipo: eventoTipo, descricao: eventoDescricao, arquivo_url, arquivo_nome, criado_por: user.id,
    } as any);

    if (error) { toast.error('Erro: ' + error.message); }
    else {
      toast.success('Evento registrado!');
      setDialogOpen(false); setEventoTipo('contato_cliente'); setEventoDescricao(''); setEventoFile(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('devedor-arquivos').download(filePath);
    if (error || !data) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteEvento = async (eventoId: string) => {
    const { error } = await supabase.from('devedor_eventos').delete().eq('id', eventoId);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Evento excluído'); fetchData(); }
  };

  const handleEditEvento = async () => {
    if (!editEventoId) return;
    setSaving(true);
    const { error } = await supabase.from('devedor_eventos').update({
      tipo: editEventoTipo, descricao: editEventoDescricao,
    }).eq('id', editEventoId);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Evento atualizado'); setEditDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  const openEditEvento = (evt: Evento) => {
    setEditEventoId(evt.id);
    setEditEventoTipo(evt.tipo);
    setEditEventoDescricao(evt.descricao);
    setEditDialogOpen(true);
  };
  const totalEmAtraso = contratos.reduce((acc, c) => acc + c.valor_atualizado, 0);

  const gerarTextoNotificacao = () => {
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const totalOriginal = contratos.reduce((acc, c) => acc + c.valor_original, 0);
    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const listaContratos = contratos.map((c, i) => {
      const venc = c.data_vencimento ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I';
      return `${i + 1}. Contrato: ${c.contrato || 'S/N'} | Vencimento: ${venc} | Valor Original: ${fmtBRL(c.valor_original)} | Valor Atualizado: ${fmtBRL(c.valor_atualizado)}`;
    }).join('\n');

    return `SOUZA & RIBEIRO
ADVOCACIA E COBRANÇAS

${devedor.credor || 'CREDOR NÃO INFORMADO'}

NOTIFICAÇÃO EXTRAJUDICIAL
Assunto: Cobrança de dívida vencida – Intimação para pagamento

À
${devedor.nome}
CPF/CNPJ: ${devedor.cpf}

Prezado(a) Cliente,

Notificamos Vossa Senhoria acerca da existência de ${contratos.length} título(s) vencido(s) e não quitados, referentes às mercadorias/serviços contratados, os quais somam o valor total originário de: ${fmtBRL(totalOriginal)}, sendo que, para efeito de negociação, esse valor será corrigido monetariamente, pela Taxa Selic diária, mais juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento).

TÍTULOS EM ABERTO:
${listaContratos}

EXIGÊNCIA
Fica concedido o prazo IMPRORROGÁVEL de 48 (quarenta e oito) horas, a contar do recebimento desta, para pagamento integral do débito, acrescido de:
- Juros de mora de 1% ao mês;
- Multa contratual de 2%;
- Correção monetária, pela Taxa Selic diária;
- Honorários e encargos de cobrança.

Pagamento via PIX (CNPJ 05.950.717/0001-18) ou depósito identificado.

CONSEQUÊNCIAS DO NÃO PAGAMENTO
O não cumprimento no prazo estipulado ensejará, sem novo aviso:
- Protesto dos títulos em cartório;
- Inclusão nos órgãos de proteção ao crédito;
- Ajuizamento de Ação de Execução, com penhora de bens;
- Pedido de desconsideração da personalidade jurídica, para atingir bens dos sócios;
- Bloqueio de valores via SISBAJUD;
- Cobrança de custas e honorários judiciais.

Esta notificação possui caráter formal e definitivo, constituindo Vossa Senhoria em mora.

Para tratativas imediatas de negociação do débito, contatar:
Luiz Carlos: (62) 99679-9697 ou Rodrigo: (62) 99167-2674.
contato@souzaeribeiro.com.br

Goiânia, ${dataAtual}.

______________________________________________________________
p.p. ${devedor.credor || 'CREDOR'}
Rodrigo Ribeiro de Souza - Souza e Ribeiro Sociedade de Advogados.

Rua 24, nº 208, Setor Marista, CEP: 74150-070, Goiânia-GO.
Telefone/WhatsApp: (62) 99679-9697 - E-mail: contato@souzaeribeiro.com.br`;
  };

  const handleOpenNotificacao = () => {
    setNotifContent(gerarTextoNotificacao());
    setNotifDialogOpen(true);
  };

  const handleDownloadNotifPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const marginLeft = 20;
    const marginRight = 20;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const topMargin = 45; // space for logo
    const bottomMargin = 35; // space for footer
    const lineHeight = 6;

    const addHeaderAndFooter = () => {
      // Logo at top
      try {
        doc.addImage(logoSouzaRibeiro, 'PNG', marginLeft, 10, 40, 25);
      } catch (e) {
        // fallback if logo fails
      }
      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Rua 24, nº 208, Setor Marista, CEP: 74150-070, Goiânia-GO.', pageWidth / 2, pageHeight - 15, { align: 'center' });
      doc.text('Telefone/WhatsApp: (62) 99679-9697 - E-mail: contato@souzaeribeiro.com.br', pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    addHeaderAndFooter();

    const contentLines = notifContent.split('\n');
    let y = topMargin;
    const boldSections = ['NOTIFICAÇÃO EXTRAJUDICIAL', 'EXIGÊNCIA', 'CONSEQUÊNCIAS DO NÃO PAGAMENTO', 'TÍTULOS EM ABERTO:'];

    for (const rawLine of contentLines) {
      const isBold = boldSections.some(s => rawLine.trim().startsWith(s));
      doc.setFontSize(isBold ? 12 : 11);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');

      const wrapped = doc.splitTextToSize(rawLine || ' ', contentWidth);
      for (const wLine of wrapped) {
        if (y > pageHeight - bottomMargin) {
          doc.addPage();
          addHeaderAndFooter();
          y = topMargin;
        }
        doc.text(wLine, marginLeft, y);
        y += lineHeight;
      }
    }

    doc.save(`Notificacao-Extrajudicial-${devedor.nome}.pdf`);
  };

  const getDiasAtraso = (dataVencimento: string | null) => {
    if (!dataVencimento) return null;
    const days = differenceInDays(new Date(), new Date(dataVencimento + 'T00:00:00'));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[50vh]">Carregando...</div></AppLayout>;
  }

  if (!devedor) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-muted-foreground">Devedor não encontrado.</p>
          <Button variant="outline" onClick={() => navigate('/clientes')}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{devedor.nome}</h1>
                  <Badge variant={devedor.estagio === 'novo' && eventos.length > 0 ? 'default' : 'secondary'} className="mt-1">
                    {devedor.estagio === 'novo' && eventos.length > 0 ? 'andamento' : devedor.estagio}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenNotificacao}>
                  <FileText className="h-4 w-4 mr-1" /> Notificação Extrajudicial
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/clientes')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">CPF/CNPJ</span>
                <span className="font-mono font-medium">{devedor.cpf}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Telefone</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{telefones.filter(t => t.ativo !== false).length > 0 ? telefones.filter(t => t.ativo !== false)[0].numero : (devedor.telefone || 'Não informado')}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTelefonesDialogOpen(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {devedor.credor && (
                <div>
                  <span className="text-muted-foreground block text-xs">Credor</span>
                  <span className="font-medium">{devedor.credor}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Telefones Dialog */}
        <Dialog open={telefonesDialogOpen} onOpenChange={setTelefonesDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Gerenciar Telefones</DialogTitle></DialogHeader>
            <TelefoneTab
              telefones={telefones}
              cpfNormalizado={cpfNorm}
              userId={user?.id || ''}
              onRefresh={fetchData}
              telefoneImportado={devedor.telefone}
              devedorId={devedor.id}
            />
          </DialogContent>
        </Dialog>

        {/* Notificação Extrajudicial Dialog */}
        <Dialog open={notifDialogOpen} onOpenChange={setNotifDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Notificação Extrajudicial
              </DialogTitle>
              <DialogDescription>
                Edite o conteúdo abaixo e clique em "Baixar PDF" para gerar o documento.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 min-h-0">
              <Textarea
                value={notifContent}
                onChange={(e) => setNotifContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotifDialogOpen(false)}>Fechar</Button>
              <Button onClick={handleDownloadNotifPDF}>
                <Download className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Contratos */}
          <div className="space-y-6">

            {/* Contratos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DollarSign className="h-4 w-4" /> Contratos
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <CalculadoraDebitoDialog contratos={contratos} devedor={devedor} />
                    <span className="text-lg font-bold text-destructive">
                      Total: {totalEmAtraso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...contratos].sort((a, b) => {
                    if (!a.data_vencimento && !b.data_vencimento) return 0;
                    if (!a.data_vencimento) return 1;
                    if (!b.data_vencimento) return -1;
                    return a.data_vencimento.localeCompare(b.data_vencimento);
                  }).map((contrato) => {
                    const dias = getDiasAtraso(contrato.data_vencimento);
                    return (
                      <Collapsible
                        key={contrato.id}
                        open={openContratos[contrato.id] || false}
                        onOpenChange={(open) => setOpenContratos(prev => ({ ...prev, [contrato.id]: open }))}
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${contrato.estagio === 'novo' ? 'bg-green-500' : 'bg-destructive'}`} />
                              <span className="font-medium text-sm">{contrato.contrato || 'S/ contrato'}</span>
                              {dias !== null && dias > 0 && (
                                <span className="text-xs text-muted-foreground">- Atraso: {dias}</span>
                              )}
                              {contrato.data_vencimento && (
                                <span className="text-xs text-muted-foreground">
                                  Venc: {new Date(contrato.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                            <div className="shrink-0">
                              {openContratos[contrato.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="text-xs">Número</TableHead>
                                  <TableHead className="text-xs">Vencimento</TableHead>
                                  <TableHead className="text-xs">Valor Original</TableHead>
                                  <TableHead className="text-xs">Valor Atualizado</TableHead>
                                  <TableHead className="text-xs">Atraso</TableHead>
                                  <TableHead className="text-xs">Estágio</TableHead>
                                  <TableHead className="text-xs">Descrição</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-xs font-medium">{contrato.contrato || '—'}</TableCell>
                                  <TableCell className="text-xs">{contrato.data_vencimento ? new Date(contrato.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                                  <TableCell className="text-xs">{contrato.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                  <TableCell className="text-xs font-semibold">{contrato.valor_atualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                                  <TableCell className="text-xs">{dias !== null && dias > 0 ? `${dias} dias` : '—'}</TableCell>
                                  <TableCell><Badge variant="secondary" className="text-xs">{contrato.estagio}</Badge></TableCell>
                                  <TableCell className="text-xs max-w-[200px] truncate">{contrato.descricao || '—'}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Eventos */}
          <div>
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" /> Eventos
                  </CardTitle>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Evento</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Registrar Evento</DialogTitle></DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={eventoTipo} onValueChange={setEventoTipo}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contato_cliente">Contato com Cliente</SelectItem>
                              <SelectItem value="anexar_arquivo">Anexar Arquivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {eventoTipo === 'anexar_arquivo' && (
                          <div className="space-y-2">
                            <Label>Arquivo</Label>
                            <Input type="file" onChange={(e) => setEventoFile(e.target.files?.[0] || null)} />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Observação</Label>
                          <Textarea placeholder="Descreva o evento..." value={eventoDescricao} onChange={(e) => setEventoDescricao(e.target.value)} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleSaveEvento} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {eventos.map((evt) => (
                      <div key={evt.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={evt.tipo === 'anexar_arquivo' ? 'secondary' : 'default'}>
                            {evt.tipo === 'contato_cliente' ? <><Phone className="h-3 w-3 mr-1" /> Contato</> : <><FileText className="h-3 w-3 mr-1" /> Arquivo</>}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditEvento(evt)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteEvento(evt.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(evt.criado_em).toLocaleDateString('pt-BR')}{' '}
                          {new Date(evt.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {operadorNomes[evt.criado_por] && ` - por ${operadorNomes[evt.criado_por]}`}
                        </p>
                        {evt.descricao && <p className="text-sm break-words">{evt.descricao}</p>}
                        {evt.arquivo_url && evt.arquivo_nome && (
                          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => handleDownload(evt.arquivo_url!, evt.arquivo_nome!)}>
                            <Download className="h-3 w-3 mr-1 shrink-0" />
                            <span className="truncate">{evt.arquivo_nome}</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Edit Evento Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Editar Evento</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={editEventoTipo} onValueChange={setEditEventoTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contato_cliente">Contato com Cliente</SelectItem>
                      <SelectItem value="anexar_arquivo">Anexar Arquivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea value={editEventoDescricao} onChange={(e) => setEditEventoDescricao(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleEditEvento} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppLayout>
  );
}
