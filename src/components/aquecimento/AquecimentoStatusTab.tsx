import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Image as ImageIcon, Upload, Trash2, Send, RefreshCw, PlayCircle, Power } from 'lucide-react';
import { format } from 'date-fns';

interface ImagemPool {
  id: string;
  nome: string;
  storage_path: string;
  public_url: string;
  caption: string | null;
  ativo: boolean;
  criado_em: string;
}

interface LogPost {
  id: string;
  instancia_id: string;
  imagem_id: string | null;
  status: string;
  erro: string | null;
  postado_em: string;
  proximo_post_em: string | null;
  instance_name?: string;
}

export default function AquecimentoStatusTab() {
  const [imagens, setImagens] = useState<ImagemPool[]>([]);
  const [logs, setLogs] = useState<LogPost[]>([]);
  const [habilitado, setHabilitado] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [executando, setExecutando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [{ data: imgs }, { data: cfg }, { data: logRaw }] = await Promise.all([
      supabase.from('whatsapp_aquecimento_status_imagens').select('*').order('criado_em', { ascending: false }),
      supabase.from('whatsapp_aquecimento_config').select('valor').eq('chave', 'status_habilitado').maybeSingle(),
      supabase.from('whatsapp_aquecimento_status_log').select('*').order('postado_em', { ascending: false }).limit(50),
    ]);
    setImagens((imgs as any) || []);
    setHabilitado(cfg?.valor === true || cfg?.valor === 'true' || cfg === null);

    const instIds = Array.from(new Set((logRaw || []).map((l: any) => l.instancia_id)));
    const { data: insts } = await supabase
      .from('user_whatsapp_instances')
      .select('id, nome')
      .in('id', instIds.length ? instIds : ['00000000-0000-0000-0000-000000000000']);
    const nameMap = new Map((insts || []).map((i: any) => [i.id, i.nome]));
    setLogs(((logRaw as any) || []).map((l: any) => ({ ...l, instance_name: nameMap.get(l.instancia_id) || l.instancia_id.slice(0, 8) })));
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('aquecimento-status-images').upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('aquecimento-status-images').getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from('whatsapp_aquecimento_status_imagens').insert({
        user_id: user!.id,
        nome: file.name,
        storage_path: path,
        public_url: pub.publicUrl,
        ativo: true,
      });
      if (insErr) throw insErr;
      toast.success('Imagem adicionada ao pool');
      carregar();
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const toggleAtivo = async (img: ImagemPool) => {
    await supabase.from('whatsapp_aquecimento_status_imagens').update({ ativo: !img.ativo }).eq('id', img.id);
    carregar();
  };

  const remover = async (img: ImagemPool) => {
    if (!confirm(`Remover "${img.nome}" do pool?`)) return;
    await supabase.storage.from('aquecimento-status-images').remove([img.storage_path]);
    await supabase.from('whatsapp_aquecimento_status_imagens').delete().eq('id', img.id);
    toast.success('Removida');
    carregar();
  };

  const toggleHabilitado = async (v: boolean) => {
    setHabilitado(v);
    await supabase.from('whatsapp_aquecimento_config').upsert({ chave: 'status_habilitado', valor: v as any }, { onConflict: 'chave' });
    toast.success(v ? 'Postagem de status habilitada' : 'Postagem de status desabilitada');
  };

  const executarAgora = async () => {
    if (!confirm('Postar status AGORA em todas instâncias elegíveis (respeitando cooldown)? Use com cuidado para não burlar a cadência anti-ban.')) return;
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-aquecimento-status', { body: {} });
      if (error) throw error;
      toast.success(`Execução concluída. ${data?.total || 0} postagens.`);
      carregar();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setExecutando(false);
    }
  };

  const ativas = imagens.filter(i => i.ativo).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Postagem Automática de Status
            </CardTitle>
            <div className="flex items-center gap-3">
              <Label className="flex items-center gap-2 text-sm">
                <Power className="h-4 w-4" /> Habilitado
              </Label>
              <Switch checked={habilitado} onCheckedChange={toggleHabilitado} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Cada instância em aquecimento (EM_AQUECIMENTO/AQUECIDO) posta um status a cada <strong>48-72h</strong> (intervalo aleatório por instância),
            entre <strong>09h-19h BRT</strong>, nunca aos domingos. Cada postagem sorteia uma imagem do pool sem repetir as últimas 3.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <Badge variant="outline">{ativas} ativas</Badge>{' '}
              <span className="text-muted-foreground">de {imagens.length} no pool</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="gap-1">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={executarAgora} disabled={executando || !habilitado || ativas === 0} className="gap-1">
                <PlayCircle className="h-4 w-4" /> {executando ? 'Executando...' : 'Executar Agora'}
              </Button>
              <label>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                <Button asChild size="sm" className="gap-1" disabled={uploading}>
                  <span><Upload className="h-4 w-4" /> {uploading ? 'Enviando...' : 'Adicionar Imagem'}</span>
                </Button>
              </label>
            </div>
          </div>

          {imagens.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma imagem no pool. Adicione pelo menos 1 para iniciar as postagens.</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {imagens.map(img => (
              <Card key={img.id} className={!img.ativo ? 'opacity-50' : ''}>
                <div className="relative aspect-[9/16] bg-muted rounded-t overflow-hidden">
                  <img src={img.public_url} alt={img.nome} className="w-full h-full object-cover" />
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-medium truncate" title={img.nome}>{img.nome}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={img.ativo} onCheckedChange={() => toggleAtivo(img)} />
                      <span className="text-xs">{img.ativo ? 'Ativa' : 'Inativa'}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remover(img)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" /> Histórico (últimas 50 postagens)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Instância</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próxima</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.postado_em), 'dd/MM HH:mm')}</TableCell>
                  <TableCell className="text-xs">{l.instance_name}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === 'enviado' ? 'default' : 'destructive'} className="text-xs">{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{l.proximo_post_em ? format(new Date(l.proximo_post_em), 'dd/MM HH:mm') : '-'}</TableCell>
                  <TableCell className="text-xs max-w-[300px] truncate text-destructive" title={l.erro || ''}>{l.erro || '-'}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma postagem ainda</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
