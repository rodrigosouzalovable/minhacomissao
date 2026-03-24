import { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, Play, Pause, Trash2, Send, StopCircle, Download, Plus, Mic, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportarParaExcel } from '@/lib/exportExcel';
import * as XLSX from 'xlsx';

type Campaign = {
  id: string;
  name: string;
  audio_url: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  total_contacts: number;
  total_sent: number;
  total_errors: number;
};

type CampaignContact = {
  id: string;
  campaign_id: string;
  telefone: string;
  nome: string | null;
  status: string;
  enviado_em: string | null;
  erro_mensagem: string | null;
};

export default function CampanhasVoz() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [contactSource, setContactSource] = useState<'acordos' | 'devedores' | 'planilha'>('acordos');
  const [importedContacts, setImportedContacts] = useState<{ id: string; nome: string; telefone: string }[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelRef = useRef(false);

  // Fetch campaigns
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['voice-campaigns', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('voice_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user,
  });

  // Fetch campaign contacts
  const { data: campaignContacts = [] } = useQuery({
    queryKey: ['voice-campaign-contacts', selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from('voice_campaign_contacts')
        .select('*')
        .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CampaignContact[];
    },
    enabled: !!selectedCampaignId,
  });

  // Fetch WhatsApp instances
  const { data: instances = [] } = useQuery({
    queryKey: ['whatsapp-instances-voice', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_whatsapp_instances')
        .select('id, nome, server_url, instance_token')
        .eq('user_id', user!.id)
        .eq('ativo', true);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  // Fetch contacts for selection
  const { data: dbContacts = [] } = useQuery({
    queryKey: ['available-contacts', contactSource, user?.id],
    queryFn: async () => {
      if (contactSource === 'acordos') {
        const { data, error } = await supabase
          .from('acordos')
          .select('id, cliente_nome, cliente_telefone')
          .eq('user_id', user!.id)
          .eq('status', 'ativo')
          .not('cliente_telefone', 'is', null);
        if (error) throw error;
        return (data || []).map(a => ({
          id: a.id,
          nome: a.cliente_nome,
          telefone: a.cliente_telefone!,
        }));
      } else if (contactSource === 'devedores') {
        const { data, error } = await supabase
          .from('devedores')
          .select('id, nome, telefone')
          .eq('ativo', true)
          .not('telefone', 'is', null);
        if (error) throw error;
        return (data || []).map(d => ({
          id: d.id,
          nome: d.nome,
          telefone: d.telefone!,
        }));
      }
      return [];
    },
    enabled: !!user && contactSource !== 'planilha',
  });

  const availableContacts = contactSource === 'planilha' ? importedContacts : dbContacts;

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const contacts = rows.slice(1)
        .filter(row => row[2])
        .map(row => ({
          id: crypto.randomUUID(),
          nome: String(row[1] || ''),
          telefone: String(row[2] || '').replace(/\D/g, ''),
        }))
        .filter(c => c.telefone.length >= 8);
      setImportedContacts(contacts);
      setSelectedContacts(new Set());
      toast.success(`${contacts.length} contatos importados da planilha`);
    };
    reader.readAsArrayBuffer(file);
  };

  // Audio file handling
  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav'];
    if (!allowed.some(t => file.type.startsWith(t.split('/')[0]))) {
      toast.error('Formato de áudio não suportado');
      return;
    }
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Create campaign
  const createCampaign = async () => {
    if (!user || !audioFile || !campaignName.trim()) {
      toast.error('Preencha o nome e selecione um áudio');
      return;
    }
    setUploading(true);
    try {
      const ext = audioFile.name.split('.').pop() || 'mp3';
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-audio')
        .upload(filePath, audioFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('campaign-audio')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('voice_campaigns')
        .insert({
          user_id: user.id,
          name: campaignName.trim(),
          audio_url: publicUrl,
        } as any);
      if (error) throw error;

      toast.success('Campanha criada!');
      setCampaignName('');
      setAudioFile(null);
      setAudioPreviewUrl(null);
      setShowNewCampaign(false);
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar campanha');
    } finally {
      setUploading(false);
    }
  };

  // Add contacts to campaign
  const addContactsToCampaign = async () => {
    if (!selectedCampaignId || selectedContacts.size === 0) return;
    const contacts = availableContacts.filter(c => selectedContacts.has(c.id));
    const inserts = contacts.map(c => ({
      campaign_id: selectedCampaignId,
      telefone: c.telefone,
      nome: c.nome,
    }));

    const { error } = await supabase
      .from('voice_campaign_contacts')
      .insert(inserts as any);
    if (error) {
      toast.error('Erro ao adicionar contatos');
      return;
    }

    // Update total_contacts
    await supabase
      .from('voice_campaigns')
      .update({ total_contacts: (campaignContacts.length + contacts.length) } as any)
      .eq('id', selectedCampaignId);

    toast.success(`${contacts.length} contatos adicionados`);
    setSelectedContacts(new Set());
    queryClient.invalidateQueries({ queryKey: ['voice-campaign-contacts'] });
    queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });
  };

  // Start sending campaign
  const startCampaign = async (campaign: Campaign) => {
    if (instances.length === 0) {
      toast.error('Nenhuma instância WhatsApp conectada');
      return;
    }
    const instance = selectedInstanceId
      ? instances.find(i => i.id === selectedInstanceId)
      : instances[0];
    if (!instance) {
      toast.error('Selecione uma instância WhatsApp');
      return;
    }

    // Get pending contacts
    const { data: pendingContacts, error } = await supabase
      .from('voice_campaign_contacts')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('status', 'pendente');
    if (error || !pendingContacts?.length) {
      toast.error('Nenhum contato pendente para enviar');
      return;
    }

    setSendingCampaignId(campaign.id);
    cancelRef.current = false;

    await supabase
      .from('voice_campaigns')
      .update({ status: 'enviando', started_at: new Date().toISOString() } as any)
      .eq('id', campaign.id);
    queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });

    toast.success(`Iniciando envio para ${pendingContacts.length} contatos...`);

    let sent = campaign.total_sent;
    let errors = campaign.total_errors;

    for (let i = 0; i < pendingContacts.length; i++) {
      if (cancelRef.current) break;
      const contact = pendingContacts[i];

      try {
        const { data, error: fnError } = await supabase.functions.invoke('send-whatsapp-audio', {
          body: {
            telefone: contact.telefone,
            audio_url: campaign.audio_url,
            uazapi_server_url: instance.server_url,
            uazapi_instance_token: instance.instance_token,
          },
        });

        if (fnError || !data?.success) {
          const errMsg = fnError?.message || data?.error || 'Erro';
          await supabase.from('voice_campaign_contacts').update({ status: 'erro', erro_mensagem: errMsg } as any).eq('id', contact.id);
          errors++;
        } else {
          await supabase.from('voice_campaign_contacts').update({ status: 'enviado', enviado_em: new Date().toISOString() } as any).eq('id', contact.id);
          sent++;
        }
      } catch (err: any) {
        await supabase.from('voice_campaign_contacts').update({ status: 'erro', erro_mensagem: err.message } as any).eq('id', contact.id);
        errors++;
      }

      await supabase.from('voice_campaigns').update({ total_sent: sent, total_errors: errors } as any).eq('id', campaign.id);
      queryClient.invalidateQueries({ queryKey: ['voice-campaign-contacts', campaign.id] });

      // Random delay 5-15 min between sends (skip last)
      if (i < pendingContacts.length - 1 && !cancelRef.current) {
        const delay = (5 + Math.random() * 10) * 60 * 1000;
        const mins = Math.round(delay / 60000);
        toast.info(`Próximo envio em ~${mins} minutos...`);
        await new Promise<void>(resolve => {
          const timer = setTimeout(resolve, delay);
          const check = setInterval(() => {
            if (cancelRef.current) {
              clearTimeout(timer);
              clearInterval(check);
              resolve();
            }
          }, 1000);
        });
      }
    }

    const finalStatus = cancelRef.current ? 'cancelado' : 'concluido';
    await supabase.from('voice_campaigns').update({
      status: finalStatus,
      finished_at: new Date().toISOString(),
      total_sent: sent,
      total_errors: errors,
    } as any).eq('id', campaign.id);

    setSendingCampaignId(null);
    queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['voice-campaign-contacts', campaign.id] });
    toast.success(cancelRef.current ? 'Campanha cancelada' : 'Campanha finalizada!');
  };

  const cancelCampaign = () => {
    cancelRef.current = true;
  };

  const exportReport = (contacts: CampaignContact[]) => {
    exportarParaExcel(contacts, [
      { chave: 'nome', titulo: 'Nome' },
      { chave: 'telefone', titulo: 'Telefone' },
      { chave: 'status', titulo: 'Status' },
      { chave: 'enviado_em', titulo: 'Enviado Em' },
      { chave: 'erro_mensagem', titulo: 'Erro' },
    ], 'relatorio-campanha-voz');
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;
    try {
      await supabase.from('voice_campaign_contacts').delete().eq('campaign_id', campaignId);
      await supabase.from('voice_campaigns').delete().eq('id', campaignId);
      if (selectedCampaignId === campaignId) setSelectedCampaignId(null);
      queryClient.invalidateQueries({ queryKey: ['voice-campaigns'] });
      toast.success('Campanha excluída');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const toggleAllContacts = () => {
    if (selectedContacts.size === availableContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(availableContacts.map(c => c.id)));
    }
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const statusColors: Record<string, string> = {
    pendente: 'bg-yellow-100 text-yellow-800',
    enviado: 'bg-green-100 text-green-800',
    erro: 'bg-red-100 text-red-800',
    rascunho: 'bg-muted text-muted-foreground',
    enviando: 'bg-blue-100 text-blue-800',
    concluido: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campanhas de Voz</h1>
            <p className="text-muted-foreground">Envie áudios em massa via WhatsApp</p>
          </div>
          <Button onClick={() => setShowNewCampaign(!showNewCampaign)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {/* New Campaign Form */}
        {showNewCampaign && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Criar Campanha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome da Campanha</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Lembrete de pagamento"
                />
              </div>
              <div>
                <Label>WhatsApp para envio</Label>
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar WhatsApp" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.nome || 'Instância'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Áudio (MP3, M4A, AAC, OGG, WAV)</Label>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                />
              </div>
              {audioPreviewUrl && (
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" onClick={togglePlay}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <audio
                    ref={audioRef}
                    src={audioPreviewUrl}
                    onEnded={() => setIsPlaying(false)}
                  />
                  <span className="text-sm text-muted-foreground">{audioFile?.name}</span>
                </div>
              )}
              <div>
                <Label className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar contatos da planilha (Coluna B = Nome, Coluna C = Telefone)
                </Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelImport}
                  className="mt-1"
                />
                {importedContacts.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {importedContacts.length} contatos importados
                  </p>
                )}
              </div>
              <Button onClick={createCampaign} disabled={uploading || !audioFile || !campaignName.trim()}>
                {uploading ? 'Enviando...' : 'Criar Campanha'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Campaign List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(campaign => (
            <Card
              key={campaign.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                selectedCampaignId === campaign.id && "border-primary ring-1 ring-primary"
              )}
              onClick={() => setSelectedCampaignId(campaign.id)}
            >
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{campaign.name}</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[campaign.status] || ''}>
                      {campaign.status}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteCampaign(campaign.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{campaign.total_contacts} contatos</p>
                  <p className="text-green-600">{campaign.total_sent} enviados</p>
                  {campaign.total_errors > 0 && (
                    <p className="text-red-600">{campaign.total_errors} erros</p>
                  )}
                  <p>{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {campaigns.length === 0 && !loadingCampaigns && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              Nenhuma campanha criada ainda
            </p>
          )}
        </div>

        {/* Campaign Detail */}
        {selectedCampaign && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{selectedCampaign.name}</CardTitle>
                <div className="flex gap-2">
                  {selectedCampaign.status !== 'enviando' && campaignContacts.length > 0 && (
                    <>
                      <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Selecionar WhatsApp" />
                        </SelectTrigger>
                        <SelectContent>
                          {instances.map(inst => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.nome || 'Instância'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => startCampaign(selectedCampaign)}
                        disabled={sendingCampaignId !== null}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Iniciar Envio
                      </Button>
                    </>
                  )}
                  {sendingCampaignId === selectedCampaign.id && (
                    <Button variant="destructive" onClick={cancelCampaign}>
                      <StopCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                  {campaignContacts.length > 0 && (
                    <Button variant="outline" onClick={() => exportReport(campaignContacts)}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Audio preview */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <audio controls src={selectedCampaign.audio_url} className="flex-1 h-8" />
              </div>

              {/* Add contacts section */}
              {(selectedCampaign.status === 'rascunho' || selectedCampaign.status === 'cancelado') && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Adicionar Contatos</h4>
                    <Select value={contactSource} onValueChange={(v: 'acordos' | 'devedores' | 'planilha') => { setContactSource(v); setSelectedContacts(new Set()); }}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acordos">Acordos</SelectItem>
                        <SelectItem value="devedores">Devedores</SelectItem>
                        <SelectItem value="planilha">Planilha</SelectItem>
                      </SelectContent>
                    </Select>
                   </div>

                  {contactSource === 'planilha' && (
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleExcelImport}
                        className="max-w-xs"
                      />
                      <span className="text-xs text-muted-foreground">Coluna B = Nome, Coluna C = Telefone</span>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedContacts.size === availableContacts.length && availableContacts.length > 0}
                              onCheckedChange={toggleAllContacts}
                            />
                          </TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableContacts.map(c => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedContacts.has(c.id)}
                                onCheckedChange={() => toggleContact(c.id)}
                              />
                            </TableCell>
                            <TableCell className="text-sm">{c.nome}</TableCell>
                            <TableCell className="text-sm">{c.telefone}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    onClick={addContactsToCampaign}
                    disabled={selectedContacts.size === 0}
                    size="sm"
                  >
                    Adicionar {selectedContacts.size} contato{selectedContacts.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              )}

              {/* Contacts report */}
              {campaignContacts.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado Em</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignContacts.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-sm">{c.nome || '-'}</TableCell>
                          <TableCell className="text-sm">{c.telefone}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[c.status] || ''} variant="secondary">
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {c.enviado_em ? new Date(c.enviado_em).toLocaleString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-red-600 max-w-32 truncate">
                            {c.erro_mensagem || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
