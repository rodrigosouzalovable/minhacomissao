import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Loader2, Plus, Search, ExternalLink, Pencil, Trash2, Globe, ShieldCheck, Copy, Building2,
} from 'lucide-react';

interface SiteRow {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_site: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  cnae: string | null;
  abertura: string | null;
  sobre: string | null;
  foto_url: string | null;
  meta_verification: string | null;
  worker_name: string | null;
  url: string | null;
  status: string;
  criado_em: string;
}

const vazio = {
  id: null as string | null,
  cnpj: '',
  razao_social: '',
  nome_site: '',
  telefone: '',
  email: '',
  endereco: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  cnae: '',
  abertura: '',
  sobre: '',
  foto_url: '',
  meta_verification: '',
};

type Form = typeof vazio;

const soDigitos = (v: string) => v.replace(/\D/g, '');

const formatCnpj = (v: string) => {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const extrairCodigoMeta = (v: string) => {
  const raw = v.trim();
  if (!raw) return '';
  const m = raw.match(/content\s*=\s*["']([^"']+)["']/i) || raw.match(/facebook-domain-verification=([\w-]+)/i);
  return (m ? m[1] : raw).trim();
};

export default function MeusSites() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(vazio);
  const [consultando, setConsultando] = useState(false);
  const [excluir, setExcluir] = useState<SiteRow | null>(null);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['sites-gerados'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sites_gerados')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SiteRow[];
    },
    staleTime: 60_000,
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return sites;
    const d = soDigitos(t);
    return sites.filter(
      (s) =>
        s.razao_social.toLowerCase().includes(t) ||
        (s.nome_site ?? '').toLowerCase().includes(t) ||
        (s.cidade ?? '').toLowerCase().includes(t) ||
        (d.length >= 3 && s.cnpj.includes(d)),
    );
  }, [sites, busca]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const abrirNovo = () => {
    setForm(vazio);
    setDialogOpen(true);
  };

  const abrirEdicao = (s: SiteRow) => {
    setForm({
      id: s.id,
      cnpj: formatCnpj(s.cnpj),
      razao_social: s.razao_social,
      nome_site: s.nome_site ?? '',
      telefone: s.telefone ?? '',
      email: s.email ?? '',
      endereco: s.endereco ?? '',
      bairro: s.bairro ?? '',
      cidade: s.cidade ?? '',
      uf: s.uf ?? '',
      cep: s.cep ?? '',
      cnae: s.cnae ?? '',
      abertura: s.abertura ?? '',
      sobre: s.sobre ?? '',
      foto_url: s.foto_url ?? '',
      meta_verification: s.meta_verification ?? '',
    });
    setDialogOpen(true);
  };

  const consultarCnpj = async () => {
    const cnpj = soDigitos(form.cnpj);
    if (cnpj.length !== 14) return toast.error('Informe os 14 dígitos do CNPJ.');
    setConsultando(true);
    try {
      const { data, error } = await supabase.functions.invoke('cnpj-consultar', { body: { cnpj } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha na consulta');
      const e = data.empresa;
      set({
        razao_social: e.razao_social || form.razao_social,
        nome_site: form.nome_site || e.nome_fantasia || '',
        endereco: e.endereco || '',
        bairro: e.bairro || '',
        cidade: e.cidade || '',
        uf: e.uf || '',
        cep: e.cep || '',
        cnae: e.cnae || '',
        abertura: e.abertura || '',
        telefone: form.telefone || e.telefone || '',
        email: form.email || e.email || '',
      });
      toast.success('Dados da Receita carregados');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao consultar CNPJ');
    }
    setConsultando(false);
  };

  const publicar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('site-publicar', {
        body: { ...form, meta_verification: extrairCodigoMeta(form.meta_verification) },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao publicar');
      return data;
    },
    onSuccess: (data) => {
      toast.success('Site publicado: ' + data.url);
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['sites-gerados'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao publicar site'),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('site-excluir', { body: { id } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao excluir');
    },
    onSuccess: () => {
      toast.success('Site excluído');
      setExcluir(null);
      qc.invalidateQueries({ queryKey: ['sites-gerados'] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao excluir site'),
  });

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success('Copiado');
  };

  return (
    <AppLayout>
    <div className="container mx-auto p-4 space-y-4 max-w-6xl">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Meus Sites
            </CardTitle>
            <CardDescription>
              {sites.length} site(s) criado(s). O site é publicado com HTML real, então a meta tag de verificação da
              Meta é lida na hora.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings className="h-4 w-4 mr-2" /> Configurar Cloudflare
            </Button>
            <Button onClick={abrirNovo}>
              <Plus className="h-4 w-4 mr-2" /> Criar site
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por nome, CNPJ ou cidade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              Nenhum site {busca ? 'encontrado' : 'criado ainda'}. Clique em “Criar site” para começar.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtrados.map((s) => (
                <Card key={s.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant={s.status === 'live' ? 'default' : 'secondary'}>
                        {s.status === 'live' ? 'live' : 'rascunho'}
                      </Badge>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirEdicao(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExcluir(s)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm leading-snug">{s.nome_site || s.razao_social}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{formatCnpj(s.cnpj)}</p>
                    {(s.cidade || s.uf) && (
                      <p className="text-xs text-muted-foreground">{[s.cidade, s.uf].filter(Boolean).join(' / ')}</p>
                    )}
                    {s.url && (
                      <div className="flex items-center gap-1">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline break-all flex-1"
                        >
                          {s.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => s.url && copiar(s.url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost" className="h-6 w-6">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    )}
                    {s.meta_verification && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> verificação configurada
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar site' : 'Criar site'}</DialogTitle>
            <DialogDescription>
              Digite o CNPJ para preencher automaticamente os dados da Receita Federal, complete o contato e cole o
              código de verificação da Meta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>CNPJ *</Label>
              <div className="flex gap-2">
                <Input
                  value={form.cnpj}
                  onChange={(e) => set({ cnpj: formatCnpj(e.target.value) })}
                  placeholder="00.000.000/0000-00"
                />
                <Button variant="outline" onClick={consultarCnpj} disabled={consultando}>
                  {consultando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Buscar</span>
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Razão social *</Label>
                <Input value={form.razao_social} onChange={(e) => set({ razao_social: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Nome no site</Label>
                <Input
                  value={form.nome_site}
                  onChange={(e) => set({ nome_site: e.target.value })}
                  placeholder="Ex: Souza e Ribeiro"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => set({ telefone: soDigitos(e.target.value).slice(0, 11) })}
                  placeholder="62981810202"
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => set({ endereco: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => set({ bairro: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set({ cidade: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Input
                  value={form.uf}
                  onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="GO"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => set({ cep: soDigitos(e.target.value).slice(0, 8) })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Sobre o negócio (opcional, mas recomendado)</Label>
              <Textarea
                rows={3}
                value={form.sobre}
                onChange={(e) => set({ sobre: e.target.value })}
                placeholder="Descreva em 2-3 frases o que a empresa realmente faz. Esse texto substitui o conteúdo genérico do site — evite repetir o mesmo texto entre empresas diferentes."
              />
            </div>

            <div className="rounded-lg border p-3 space-y-3 bg-muted/40">
              <p className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Verificação de domínio da Meta
              </p>
              <div className="space-y-1.5">
                <Label>Código de verificação</Label>
                <Input
                  value={form.meta_verification}
                  onChange={(e) => set({ meta_verification: e.target.value })}
                  placeholder='Cole o código ou a tag inteira: <meta name="facebook-domain-verification" content="..." />'
                />
                <p className="text-xs text-muted-foreground">
                  A tag é inserida no HTML do site publicado. Depois de salvar, volte ao Business Manager e clique em
                  “Verificar domínio”.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>URL da foto (opcional)</Label>
                <Input
                  value={form.foto_url}
                  onChange={(e) => set({ foto_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => publicar.mutate()} disabled={publicar.isPending}>
              {publicar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.id ? 'Salvar e republicar' : 'Salvar e publicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir site?</AlertDialogTitle>
            <AlertDialogDescription>
              O site “{excluir?.nome_site || excluir?.razao_social}” sairá do ar e o registro será removido. Isso pode
              invalidar a verificação de domínio na Meta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && remover.mutate(excluir.id)}>
              {remover.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
