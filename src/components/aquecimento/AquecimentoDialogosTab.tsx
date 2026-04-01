import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, MessageSquare, Volume2 } from 'lucide-react';

interface Dialogo {
  id: string;
  tipo: string;
  conteudo: string;
  conteudo_resposta_esperada: string | null;
  fase_minima: number;
  ativo: boolean;
  tags: string[] | null;
}

const EMPTY_FORM = { tipo: 'texto', conteudo: '', conteudo_resposta_esperada: '', fase_minima: 1, ativo: true };

export default function AquecimentoDialogosTab() {
  const [dialogos, setDialogos] = useState<Dialogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { loadDialogos(); }, []);

  async function loadDialogos() {
    setLoading(true);
    const { data } = await supabase.from('whatsapp_aquecimento_dialogos' as any).select('*').order('fase_minima', { ascending: true });
    if (data) setDialogos(data as any[]);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(d: Dialogo) {
    setEditingId(d.id);
    setForm({ tipo: d.tipo, conteudo: d.conteudo, conteudo_resposta_esperada: d.conteudo_resposta_esperada || '', fase_minima: d.fase_minima, ativo: d.ativo });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.conteudo.trim()) {
      toast({ title: 'Preencha o conteúdo', variant: 'destructive' });
      return;
    }
    const payload = {
      tipo: form.tipo,
      conteudo: form.conteudo,
      conteudo_resposta_esperada: form.conteudo_resposta_esperada || null,
      fase_minima: form.fase_minima,
      ativo: form.ativo,
    };
    if (editingId) {
      await supabase.from('whatsapp_aquecimento_dialogos' as any).update(payload as any).eq('id', editingId);
      toast({ title: 'Diálogo atualizado!' });
    } else {
      await supabase.from('whatsapp_aquecimento_dialogos' as any).insert(payload as any);
      toast({ title: 'Diálogo criado!' });
    }
    setDialogOpen(false);
    loadDialogos();
  }

  async function handleDelete(id: string) {
    await supabase.from('whatsapp_aquecimento_dialogos' as any).delete().eq('id', id);
    toast({ title: 'Diálogo removido' });
    loadDialogos();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('whatsapp_aquecimento_dialogos' as any).update({ ativo } as any).eq('id', id);
    loadDialogos();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mensagens e Áudios do Aquecimento</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Adicionar Diálogo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Diálogo' : 'Novo Diálogo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Tipo de Mensagem</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="texto">📝 Texto</SelectItem>
                    <SelectItem value="audio">🎙️ Áudio</SelectItem>
                    <SelectItem value="imagem">🖼️ Imagem</SelectItem>
                    <SelectItem value="sticker">😄 Sticker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{form.tipo === 'texto' ? 'Mensagem de Texto' : form.tipo === 'audio' ? 'URL do Áudio' : 'Conteúdo / URL'}</Label>
                <Textarea
                  value={form.conteudo}
                  onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                  placeholder={form.tipo === 'texto' ? 'Ex: Oi, tudo bem? Como vai?' : 'Ex: https://exemplo.com/audio.mp3'}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <Label>Resposta Esperada <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Textarea
                  value={form.conteudo_resposta_esperada}
                  onChange={e => setForm(f => ({ ...f, conteudo_resposta_esperada: e.target.value }))}
                  placeholder="Ex: Tudo bem sim! E você?"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">Se preenchido, o número que receber a mensagem responderá com este texto.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Fase Mínima</Label>
                  <Select value={String(form.fase_minima)} onValueChange={v => setForm(f => ({ ...f, fase_minima: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Fase 1 - Início</SelectItem>
                      <SelectItem value="2">Fase 2</SelectItem>
                      <SelectItem value="3">Fase 3</SelectItem>
                      <SelectItem value="4">Fase 4</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Esta mensagem só será usada a partir desta fase.</p>
                </div>
                <div className="space-y-1">
                  <Label>Ativo</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                    <span className="text-sm text-muted-foreground">{form.ativo ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editingId ? 'Salvar Alterações' : 'Criar Diálogo'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : dialogos.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum diálogo cadastrado. Clique em "Adicionar Diálogo" para começar.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Resposta Esperada</TableHead>
                <TableHead>Fase Mín.</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dialogos.map(d => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {d.tipo === 'texto' ? <MessageSquare className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      {d.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm">{d.conteudo}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{d.conteudo_resposta_esperada || '-'}</TableCell>
                  <TableCell>Fase {d.fase_minima}</TableCell>
                  <TableCell>
                    <Switch checked={d.ativo} onCheckedChange={v => toggleAtivo(d.id, v)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
