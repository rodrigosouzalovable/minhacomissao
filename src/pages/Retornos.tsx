import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { ArrowLeft, Mic, MicOff, Trash2, Check, Calendar, User, Phone, FileText, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const retornoSchema = z.object({
  clienteNome: z.string().min(2, 'Nome do cliente é obrigatório').max(200, 'Nome muito longo'),
  clienteCpf: z.string().min(11, 'CPF é obrigatório').max(14, 'CPF inválido'),
  clienteTelefone: z.string().min(10, 'Telefone é obrigatório').max(15, 'Telefone inválido'),
  observacao: z.string().max(2000, 'Observação muito longa').optional(),
  dataRetorno: z.string().min(1, 'Data de retorno é obrigatória'),
});

// Funções de máscara
const formatNome = (value: string) => {
  return value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
};

const formatCpf = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return numbers
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

interface Retorno {
  id: string;
  user_id: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone: string;
  observacao: string | null;
  data_retorno: string;
  status: string;
  criado_em: string;
}

export default function Retornos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [retornos, setRetornos] = useState<Retorno[]>([]);
  const [loadingRetornos, setLoadingRetornos] = useState(true);
  const [nomeError, setNomeError] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [form, setForm] = useState({
    clienteNome: '',
    clienteCpf: '',
    clienteTelefone: '',
    observacao: '',
    dataRetorno: '',
  });

  // Load retornos
  useEffect(() => {
    if (user) {
      fetchRetornos();
    }
  }, [user]);

  const fetchRetornos = async () => {
    try {
      const { data, error } = await supabase
        .from('retornos')
        .select('*')
        .order('data_retorno', { ascending: true });

      if (error) throw error;
      setRetornos(data || []);
    } catch (error) {
      console.error('Error fetching retornos:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os retornos.',
      });
    } finally {
      setLoadingRetornos(false);
    }
  };

  const handleNomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const filteredValue = formatNome(rawValue);

    if (/\d/.test(rawValue)) {
      setNomeError('Este campo aceita apenas letras');
      setTimeout(() => setNomeError(''), 3000);
    }

    setForm({ ...form, clienteNome: filteredValue });
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      toast({
        title: 'Gravando...',
        description: 'Fale sua observação. Clique novamente para parar.',
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível acessar o microfone. Verifique as permissões.',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const base64Audio = await blobToBase64(audioBlob);

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Audio },
      });

      if (error) throw error;

      if (data?.text) {
        setForm(prev => ({
          ...prev,
          observacao: prev.observacao ? `${prev.observacao} ${data.text}` : data.text,
        }));
        toast({
          title: 'Transcrição concluída',
          description: 'O áudio foi transcrito com sucesso.',
        });
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na transcrição',
        description: error instanceof Error ? error.message : 'Não foi possível transcrever o áudio.',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      const validated = retornoSchema.parse({
        clienteNome: form.clienteNome.trim(),
        clienteCpf: form.clienteCpf.trim(),
        clienteTelefone: form.clienteTelefone.trim(),
        observacao: form.observacao.trim() || undefined,
        dataRetorno: form.dataRetorno,
      });

      const { error } = await supabase.from('retornos').insert({
        user_id: user.id,
        cliente_nome: validated.clienteNome,
        cliente_cpf: validated.clienteCpf,
        cliente_telefone: validated.clienteTelefone,
        observacao: validated.observacao || null,
        data_retorno: validated.dataRetorno,
      });

      if (error) throw error;

      toast({
        title: 'Retorno cadastrado!',
        description: `Retorno para ${validated.clienteNome} agendado com sucesso.`,
      });

      // Reset form
      setForm({
        clienteNome: '',
        clienteCpf: '',
        clienteTelefone: '',
        observacao: '',
        dataRetorno: '',
      });

      // Hide form and refresh list
      setShowForm(false);
      fetchRetornos();
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          variant: 'destructive',
          title: 'Dados inválidos',
          description: err.errors[0].message,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao cadastrar retorno',
          description: 'Tente novamente mais tarde.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarcarConcluido = async (retornoId: string) => {
    try {
      const { error } = await supabase
        .from('retornos')
        .update({ status: 'concluido' })
        .eq('id', retornoId);

      if (error) throw error;

      setRetornos(prev =>
        prev.map(r => (r.id === retornoId ? { ...r, status: 'concluido' } : r))
      );

      toast({
        title: 'Retorno concluído',
        description: 'O retorno foi marcado como concluído.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o retorno.',
      });
    }
  };

  const handleDeletar = async (retornoId: string) => {
    try {
      const { error } = await supabase
        .from('retornos')
        .delete()
        .eq('id', retornoId);

      if (error) throw error;

      setRetornos(prev => prev.filter(r => r.id !== retornoId));

      toast({
        title: 'Retorno excluído',
        description: 'O retorno foi removido com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir o retorno.',
      });
    }
  };

  const getStatusBadge = (status: string, dataRetorno: string) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataRet = new Date(dataRetorno + 'T00:00:00');

    if (status === 'concluido') {
      return <Badge variant="secondary">Concluído</Badge>;
    }

    if (dataRet < hoje) {
      return <Badge variant="destructive">Atrasado</Badge>;
    }

    if (dataRet.getTime() === hoje.getTime()) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">Hoje</Badge>;
    }

    return <Badge>Pendente</Badge>;
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Retornos</h1>
          </div>
          
          {retornos.length > 0 && !showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agendar Retorno
            </Button>
          )}
        </div>

        {(retornos.length === 0 || showForm) && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {showForm && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Dados do Cliente</CardTitle>
                <CardDescription>Informações do cliente para retorno</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clienteNome">Nome do Cliente *</Label>
                  <Input
                    id="clienteNome"
                    placeholder="Nome completo do cliente"
                    value={form.clienteNome}
                    onChange={handleNomeChange}
                    required
                    className={nomeError ? 'border-destructive' : ''}
                  />
                  {nomeError && (
                    <p className="text-sm text-destructive">{nomeError}</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clienteCpf">CPF *</Label>
                    <Input
                      id="clienteCpf"
                      placeholder="000.000.000-00"
                      value={form.clienteCpf}
                      onChange={(e) => setForm({ ...form, clienteCpf: formatCpf(e.target.value) })}
                      maxLength={14}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clienteTelefone">Telefone *</Label>
                    <Input
                      id="clienteTelefone"
                      placeholder="(00) 00000-0000"
                      value={form.clienteTelefone}
                      onChange={(e) => setForm({ ...form, clienteTelefone: formatPhone(e.target.value) })}
                      maxLength={15}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lembrete de Retorno</CardTitle>
                <CardDescription>Adicione uma observação e a data de retorno</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="observacao">Observação</Label>
                  <div className="relative">
                    <Textarea
                      id="observacao"
                      placeholder="Digite ou grave um áudio com sua observação de retorno..."
                      value={form.observacao}
                      onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                      rows={4}
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant={isRecording ? 'destructive' : 'outline'}
                      className="absolute right-2 top-2"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing}
                    >
                      {isTranscribing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isRecording ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {isRecording && (
                    <p className="text-sm text-muted-foreground animate-pulse">
                      🔴 Gravando... Clique no microfone para parar
                    </p>
                  )}
                  {isTranscribing && (
                    <p className="text-sm text-muted-foreground">
                      Transcrevendo áudio...
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataRetorno">Data de Retorno *</Label>
                  <Input
                    id="dataRetorno"
                    type="date"
                    value={form.dataRetorno}
                    onChange={(e) => setForm({ ...form, dataRetorno: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Cadastrando...' : 'Cadastrar Retorno'}
                </Button>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Lista de Retornos */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">
            Meus Retornos {retornos.length > 0 && `(${retornos.length})`}
          </h2>

          {loadingRetornos ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </CardContent>
            </Card>
          ) : retornos.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                Nenhum retorno cadastrado ainda.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {retornos.map((retorno) => (
                <Card key={retorno.id} className={retorno.status === 'concluido' ? 'opacity-60' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{retorno.cliente_nome}</span>
                          {getStatusBadge(retorno.status, retorno.data_retorno)}
                        </div>

                        <div className="grid gap-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span>CPF: {retorno.cliente_cpf}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{retorno.cliente_telefone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>
                              Retorno: {format(new Date(retorno.data_retorno + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </span>
                          </div>
                        </div>

                        {retorno.observacao && (
                          <p className="text-sm mt-2 p-2 bg-muted rounded">
                            {retorno.observacao}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2 sm:flex-col">
                        {retorno.status !== 'concluido' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarcarConcluido(retorno.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Concluir
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleDeletar(retorno.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
