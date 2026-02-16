import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, ChevronRight, Plus, FileText, Phone, Download, DollarSign } from 'lucide-react';

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

export default function DevedorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [devedor, setDevedor] = useState<Devedor | null>(null);
  const [contratos, setContratos] = useState<Devedor[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [openContratos, setOpenContratos] = useState<Record<string, boolean>>({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventoTipo, setEventoTipo] = useState('contato_cliente');
  const [eventoDescricao, setEventoDescricao] = useState('');
  const [eventoFile, setEventoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Fetch main devedor
    const { data: dev } = await supabase
      .from('devedores')
      .select('id, nome, cpf, telefone, credor, contrato, valor_original, valor_atualizado, data_vencimento, descricao, estagio')
      .eq('id', id)
      .eq('ativo', true)
      .single();

    if (!dev) {
      setLoading(false);
      return;
    }

    setDevedor(dev as Devedor);

    // Fetch all contracts for same CPF
    const cpfNorm = (dev as any).cpf?.replace(/\D/g, '');
    if (cpfNorm) {
      const { data: contratos } = await supabase
        .from('devedores')
        .select('id, nome, cpf, telefone, credor, contrato, valor_original, valor_atualizado, data_vencimento, descricao, estagio')
        .eq('ativo', true)
        .order('criado_em', { ascending: false });

      if (contratos) {
        const filtered = (contratos as Devedor[]).filter(
          c => c.cpf.replace(/\D/g, '') === cpfNorm
        );
        setContratos(filtered);
      }
    }

    // Fetch events
    const { data: evts } = await supabase
      .from('devedor_eventos' as any)
      .select('*')
      .eq('devedor_id', id)
      .order('criado_em', { ascending: false });

    if (evts) setEventos(evts as unknown as Evento[]);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveEvento = async () => {
    if (!user || !id) return;
    setSaving(true);

    let arquivo_url: string | null = null;
    let arquivo_nome: string | null = null;

    if (eventoTipo === 'anexar_arquivo' && eventoFile) {
      const filePath = `${id}/${Date.now()}-${eventoFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('devedor-arquivos')
        .upload(filePath, eventoFile);

      if (uploadError) {
        toast.error('Erro ao fazer upload do arquivo: ' + uploadError.message);
        setSaving(false);
        return;
      }

      arquivo_url = filePath;
      arquivo_nome = eventoFile.name;
    }

    const { error } = await supabase
      .from('devedor_eventos' as any)
      .insert({
        devedor_id: id,
        tipo: eventoTipo,
        descricao: eventoDescricao,
        arquivo_url,
        arquivo_nome,
        criado_por: user.id,
      } as any);

    if (error) {
      toast.error('Erro ao salvar evento: ' + error.message);
    } else {
      toast.success('Evento registrado com sucesso!');
      setDialogOpen(false);
      setEventoTipo('contato_cliente');
      setEventoDescricao('');
      setEventoFile(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('devedor-arquivos')
      .download(filePath);

    if (error || !data) {
      toast.error('Erro ao baixar arquivo');
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalEmAtraso = contratos.reduce((acc, c) => acc + c.valor_atualizado, 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">Carregando...</div>
      </AppLayout>
    );
  }

  if (!devedor) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-muted-foreground">Devedor não encontrado.</p>
          <Button variant="outline" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{devedor.nome}</h1>
            <p className="text-sm text-muted-foreground">
              CPF/CNPJ: <span className="font-mono">{devedor.cpf}</span>
              {devedor.telefone && <> · Tel: {devedor.telefone}</>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Contratos */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Total em Atraso
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-destructive">
                  {totalEmAtraso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {contratos.length} contrato{contratos.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            {contratos.map((contrato) => (
              <Collapsible
                key={contrato.id}
                open={openContratos[contrato.id] || false}
                onOpenChange={(open) =>
                  setOpenContratos((prev) => ({ ...prev, [contrato.id]: open }))
                }
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {contrato.contrato || 'Sem contrato'}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {contrato.credor || 'Sem credor'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">
                            {contrato.valor_atualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          {openContratos[contrato.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor Original</span>
                        <span>{contrato.valor_original.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor Atualizado</span>
                        <span className="font-semibold">{contrato.valor_atualizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                      {contrato.data_vencimento && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vencimento</span>
                          <span>{new Date(contrato.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                      {contrato.descricao && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Descrição</span>
                          <span>{contrato.descricao}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estágio</span>
                        <Badge variant="secondary">{contrato.estagio}</Badge>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>

          {/* Coluna Direita - Eventos */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Eventos
                  </CardTitle>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Novo Evento
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar Evento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select value={eventoTipo} onValueChange={setEventoTipo}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contato_cliente">Contato com Cliente</SelectItem>
                              <SelectItem value="anexar_arquivo">Anexar Arquivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {eventoTipo === 'anexar_arquivo' && (
                          <div className="space-y-2">
                            <Label>Arquivo</Label>
                            <Input
                              type="file"
                              onChange={(e) => setEventoFile(e.target.files?.[0] || null)}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Observação</Label>
                          <Textarea
                            placeholder="Descreva o evento..."
                            value={eventoDescricao}
                            onChange={(e) => setEventoDescricao(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleSaveEvento} disabled={saving}>
                          {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {eventos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum evento registrado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {eventos.map((evt) => (
                      <div key={evt.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant={evt.tipo === 'anexar_arquivo' ? 'secondary' : 'default'}>
                            {evt.tipo === 'contato_cliente' ? (
                              <><Phone className="h-3 w-3 mr-1" /> Contato</>
                            ) : (
                              <><FileText className="h-3 w-3 mr-1" /> Arquivo</>
                            )}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(evt.criado_em).toLocaleDateString('pt-BR')}{' '}
                            {new Date(evt.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {evt.descricao && (
                          <p className="text-sm">{evt.descricao}</p>
                        )}
                        {evt.arquivo_url && evt.arquivo_nome && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1"
                            onClick={() => handleDownload(evt.arquivo_url!, evt.arquivo_nome!)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {evt.arquivo_nome}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
