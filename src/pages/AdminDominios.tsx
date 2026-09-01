import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import {
  contatoDeRegistro,
  DOMINIO_BASE,
  DNS_A_VALUE,
  type ContatoPortal,
} from '@/lib/contatoPorDominio';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

type DnsRegistro = {
  tipo: 'A' | 'TXT';
  nome: string;
  esperado: string;
  encontrado: string[];
  ok: boolean;
};

type DnsResultado = {
  hostname: string;
  registros: DnsRegistro[];
  todosOk: boolean;
  verificadoEm: string;
};


type DominioRow = {
  id: string;
  hostname: string;
  responsavel_nome: string | null;
  telefone: string;
  telefone_display: string;
  email: string;
  noindex: boolean;
  ativo: boolean;
  txt_verify: string | null;
  meta_verification: string | null;
  meta_txt_verify: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  prefixo: string;
  responsavel_nome: string;
  telefone: string;
  telefone_display: string;
  email: string;
  noindex: boolean;
  txt_verify: string;
  meta_verification: string;
  meta_txt_verify: string;
};

const FORM_INITIAL: FormState = {
  prefixo: '',
  responsavel_nome: '',
  telefone: '',
  telefone_display: '',
  email: '',
  noindex: true,
  txt_verify: '',
  meta_verification: '',
  meta_txt_verify: '',
};

function prefixoDeHost(hostname: string) {
  return hostname.replace(new RegExp(`\\.${DOMINIO_BASE.replace('.', '\\.')}$`), '');
}

/** Aceita a tag completa colada da Meta ou apenas o código. */
function extrairCodigoMeta(valor: string) {
  const bruto = valor.trim();
  if (!bruto) return '';
  const match = bruto.match(/content\s*=\s*["']([^"']+)["']/i);
  if (match) return match[1].trim();
  return bruto.replace(/^facebook-domain-verification=/i, '').trim();
}

function formatarMetaTag(codigo: string) {
  return `<meta name="facebook-domain-verification" content="${codigo}" />`;
}

function normalizarTelefone(value: string) {
  return value.replace(/\D/g, '');
}

function hostValido(prefixo: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(prefixo);
}

function contatoFallback(row: DominioRow): ContatoPortal {
  return contatoDeRegistro(row);
}

function CopyField({ label, value, description }: { label: string; value: string; description?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly aria-label={label} />
        <Button type="button" variant="outline" size="icon" onClick={copy} title={`Copiar ${label}`}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export default function AdminDominios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DominioRow | null>(null);
  const [form, setForm] = useState<FormState>(FORM_INITIAL);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dnsChecking, setDnsChecking] = useState<string | null>(null);
  const [dnsResultados, setDnsResultados] = useState<Record<string, DnsResultado>>({});

  async function verificarDns(dominio: DominioRow) {
    setDnsChecking(dominio.id);
    const { data, error } = await supabase.functions.invoke('dns-check', {
      body: {
        hostname: dominio.hostname,
        a_esperado: DNS_A_VALUE,
        txt_lovable: dominio.txt_verify ?? '',
        txt_meta: dominio.meta_txt_verify ?? '',
      },
    });
    setDnsChecking(null);
    if (error || !data || (data as { error?: string }).error) {
      toast({
        title: 'Não foi possível consultar o DNS',
        description: error?.message ?? (data as { error?: string })?.error ?? 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      return;
    }
    setDnsResultados((current) => ({ ...current, [dominio.id]: data as DnsResultado }));
  }


  const { data: dominios = [], isLoading, isError } = useQuery({
    queryKey: ['admin-portal-dominios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_dominios')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DominioRow[];
    },
    staleTime: 60_000,
  });

  const selected = useMemo(
    () => dominios.find((dominio) => dominio.id === selectedId) ?? dominios[0] ?? null,
    [dominios, selectedId],
  );

  function openCreate() {
    setEditing(null);
    setForm(FORM_INITIAL);
    setDialogOpen(true);
  }

  function openEdit(dominio: DominioRow) {
    setEditing(dominio);
    setForm({
      prefixo: prefixoDeHost(dominio.hostname),
      responsavel_nome: dominio.responsavel_nome ?? '',
      telefone: dominio.telefone,
      telefone_display: dominio.telefone_display,
      email: dominio.email,
       noindex: dominio.noindex,
       txt_verify: dominio.txt_verify ?? '',
       meta_verification: dominio.meta_verification ?? '',
       meta_txt_verify: dominio.meta_txt_verify ?? '',
    });
    setDialogOpen(true);
  }

  function updateForm(field: keyof FormState, value: string | boolean) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prefixo = form.prefixo.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();
    const telefone = normalizarTelefone(form.telefone);

    if (!hostValido(prefixo)) {
      toast({ title: 'Prefixo inválido', description: 'Use somente letras minúsculas, números e hífens.', variant: 'destructive' });
      return;
    }
    if (!email || !telefone || !form.telefone_display.trim()) {
      toast({ title: 'Preencha os campos obrigatórios', description: 'Informe e-mail, telefone e telefone para exibição.', variant: 'destructive' });
      return;
    }
    if (telefone.length < 10) {
      toast({ title: 'Telefone inválido', description: 'Informe o telefone com DDD.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const payload = {
      hostname: `${prefixo}.${DOMINIO_BASE}`,
      responsavel_nome: form.responsavel_nome.trim() || null,
      telefone,
      telefone_display: form.telefone_display.trim(),
      email,
       noindex: form.noindex,
       txt_verify: form.txt_verify.trim() || null,
       meta_verification: extrairCodigoMeta(form.meta_verification) || null,
       meta_txt_verify: form.meta_txt_verify.trim() || null,
       ...(editing ? {} : { criado_por: user?.id ?? null }),
    };

    const result = editing
      ? await supabase.from('portal_dominios').update(payload).eq('id', editing.id)
      : await supabase.from('portal_dominios').insert(payload);

    setSaving(false);
    if (result.error) {
      const duplicate = result.error.code === '23505';
      toast({
        title: duplicate ? 'Subdomínio já cadastrado' : 'Não foi possível salvar',
        description: duplicate ? 'Escolha outro prefixo ou edite o cadastro existente.' : result.error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: editing ? 'Subdomínio atualizado' : 'Subdomínio criado', description: 'As informações já estão disponíveis no portal.' });
    setDialogOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['admin-portal-dominios'] });
  }

  async function toggleAtivo(dominio: DominioRow) {
    const { error } = await supabase
      .from('portal_dominios')
      .update({ ativo: !dominio.ativo })
      .eq('id', dominio.id);
    if (error) {
      toast({ title: 'Não foi possível alterar o status', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: dominio.ativo ? 'Subdomínio desativado' : 'Subdomínio ativado' });
    await queryClient.invalidateQueries({ queryKey: ['admin-portal-dominios'] });
  }

  async function toggleNoindex(dominio: DominioRow, noindex: boolean) {
    const { error } = await supabase.from('portal_dominios').update({ noindex }).eq('id', dominio.id);
    if (error) {
      toast({ title: 'Não foi possível atualizar a indexação', description: error.message, variant: 'destructive' });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-portal-dominios'] });
  }

  async function remove(dominio: DominioRow) {
    if (!window.confirm(`Remover ${dominio.hostname}? O registro no registro.br e a conexão na Lovable não serão removidos automaticamente.`)) return;
    const { error } = await supabase.from('portal_dominios').delete().eq('id', dominio.id);
    if (error) {
      toast({ title: 'Não foi possível remover', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Subdomínio removido' });
    if (selectedId === dominio.id) setSelectedId(null);
    await queryClient.invalidateQueries({ queryKey: ['admin-portal-dominios'] });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Globe className="h-8 w-8 text-primary" />
              Domínios
            </h1>
            <p className="mt-1 text-muted-foreground">Cadastre subdomínios e centralize os dados para configurar o registro.br e a Lovable.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo subdomínio
          </Button>
        </div>

        {isError && (
          <Card className="border-destructive/40">
            <CardContent className="py-5 text-sm text-destructive">Não foi possível carregar os subdomínios.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Subdomínios cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subdomínio</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Buscadores</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                )}
                {!isLoading && dominios.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum subdomínio cadastrado.</TableCell></TableRow>
                )}
                {dominios.map((dominio) => (
                  <TableRow key={dominio.id} data-state={selected?.id === dominio.id ? 'selected' : undefined}>
                    <TableCell>
                      <button className="text-left font-medium text-primary hover:underline" onClick={() => setSelectedId(dominio.id)}>
                        {dominio.hostname}
                      </button>
                    </TableCell>
                    <TableCell>{dominio.responsavel_nome || '—'}</TableCell>
                    <TableCell className="text-sm">
                      <div>{dominio.email}</div>
                      <div className="text-muted-foreground">{dominio.telefone_display}</div>
                    </TableCell>
                    <TableCell><Badge variant={dominio.ativo ? 'default' : 'secondary'}>{dominio.ativo ? 'Ativo' : 'Desativado'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={dominio.noindex} onCheckedChange={(checked) => toggleNoindex(dominio, checked)} aria-label={`Não indexar ${dominio.hostname}`} />
                        <span className="text-xs text-muted-foreground">{dominio.noindex ? 'Não indexar' : 'Indexável'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Verificar DNS" onClick={() => { setSelectedId(dominio.id); verificarDns(dominio); }} disabled={dnsChecking === dominio.id}>
                          {dnsChecking === dominio.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" title="Ver instruções" onClick={() => setSelectedId(dominio.id)}><Clipboard className="h-4 w-4" /></Button>

                        <Button variant="ghost" size="icon" title="Editar subdomínio" onClick={() => openEdit(dominio)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title={dominio.ativo ? 'Desativar' : 'Ativar'} onClick={() => toggleAtivo(dominio)}><Power className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Remover" onClick={() => remove(dominio)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Como registrar {selected.hostname}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Copie os dados abaixo e conclua a conexão nos dois painéis.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selected.ativo ? 'outline' : 'secondary'}>{selected.ativo ? 'Portal ativo' : 'Portal desativado'}</Badge>
                  <Button type="button" variant="outline" size="sm" onClick={() => verificarDns(selected)} disabled={dnsChecking === selected.id}>
                    {dnsChecking === selected.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Verificar DNS
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {dnsResultados[selected.id] && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Status dos registros DNS</p>
                    <span className="text-xs text-muted-foreground">
                      Verificado às {new Date(dnsResultados[selected.id].verificadoEm).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dnsResultados[selected.id].registros.map((registro) => (
                      <div key={`${registro.tipo}-${registro.nome}-${registro.esperado}`} className="rounded-md border bg-muted/30 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          {registro.ok ? <Check className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />}
                          <span className="font-medium">Registro {registro.tipo}</span>
                          <span className="text-muted-foreground break-all">{registro.nome}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground break-all">Esperado: {registro.esperado}</p>
                        <p className="text-xs text-muted-foreground break-all">
                          Encontrado: {registro.encontrado.length ? registro.encontrado.join(' · ') : 'nenhum valor publicado'}
                        </p>
                      </div>
                    ))}
                  </div>
                  {dnsResultados[selected.id].todosOk ? (
                    <p className="text-sm text-primary">
                      Registros propagados. Conclua em Configurações do Projeto &gt; Domínios (Complete setup / Check status). Se aparecer
                      &quot;Domain Service Error&quot;, recarregue a página antes de clicar.
                    </p>
                  ) : (
                    <p className="text-sm text-destructive">
                      Algum registro ainda não propagou ou está com valor diferente. Corrija no registro.br e verifique novamente — a propagação pode levar algumas horas.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <CopyField label="Registro A — nome" value={prefixoDeHost(selected.hostname)} description="No registro.br, use este valor no campo Nome/Host." />
                <CopyField label="Registro A — valor" value={DNS_A_VALUE} description="Endereço de destino da hospedagem Lovable." />
                <CopyField label="Domínio completo para conectar" value={selected.hostname} description="Digite exatamente este host em Configurações do Projeto > Domínios > Connect Domain." />
                <CopyField
                  label="Registro TXT — nome"
                  value={`_lovable.${prefixoDeHost(selected.hostname)}`}
                  description={`No registro.br, digite exatamente isso no campo Nome — ele completa sozinho com .${DOMINIO_BASE}.`}
                />
                 <div className="md:col-span-2">
                   {selected.txt_verify ? (
                     <CopyField label="Registro TXT — valor" value={selected.txt_verify} description="Cole este conteúdo no campo de valor/dados do registro TXT." />
                   ) : (
                     <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                       <p className="font-medium text-foreground">Registro TXT — valor não cadastrado</p>
                       <p className="mt-1">
                         Copie o valor <code>lovable_verify=...</code> exibido no fluxo Connect Domain da Lovable e salve-o em
                         {' '}<strong className="text-foreground">Editar subdomínio</strong>.
                       </p>
                     </div>
                   )}
                 </div>
                 <div className="md:col-span-2 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                   <div>
                     <p className="font-medium">Verificação de domínio na Meta</p>
                     <p className="mt-1 text-sm text-muted-foreground">Use a tag salva no site ou, preferencialmente, o registro TXT abaixo para verificar este subdomínio no Business Manager.</p>
                   </div>
                    {selected.meta_verification ? (
                      <>
                        <CopyField label="Meta tag — código" value={selected.meta_verification} description="O sistema insere este código no portal deste subdomínio." />
                        <CopyField label="Meta tag — tag completa" value={formatarMetaTag(selected.meta_verification)} description="Copie esta tag completa se precisar colá-la em outra configuração." />
                      </>
                    ) : <p className="text-sm text-muted-foreground">Nenhum código de meta tag cadastrado.</p>}
                    {selected.meta_txt_verify ? <CopyField label="TXT Meta — valor" value={selected.meta_txt_verify} description="Cole este valor no campo de dados do TXT da Meta." /> : <p className="text-sm text-muted-foreground">Para vários subdomínios, prefira a verificação TXT da Meta. Cadastre o valor em Editar subdomínio.</p>}
                   <CopyField label="TXT Meta — nome" value={prefixoDeHost(selected.hostname)} description="No registro.br, use este nome e o registro.br completará o domínio." />
                   <div className="flex flex-wrap gap-2">
                     <Button type="button" variant="outline" onClick={() => window.open('https://business.facebook.com/settings/domains', '_blank', 'noopener,noreferrer')}><ExternalLink className="mr-2 h-4 w-4" />Abrir verificação na Meta</Button>
                     <Button type="button" variant="ghost" onClick={() => openEdit(selected)}><Pencil className="mr-2 h-4 w-4" />Editar dados</Button>
                   </div>
                 </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="mb-2 flex items-center gap-2 font-semibold"><ExternalLink className="h-4 w-4 text-primary" />Passo a passo</div>
                <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>No registro.br, crie o registro A para <strong className="text-foreground">{prefixoDeHost(selected.hostname)}</strong> apontando para <strong className="text-foreground">{DNS_A_VALUE}</strong>.</li>
                  <li>Na Lovable, abra Configurações do Projeto &gt; Domínios &gt; Connect Domain e informe <strong className="text-foreground">{selected.hostname}</strong>.</li>
                  <li>
                    No registro.br, crie o registro TXT com nome <strong className="text-foreground">_lovable.{prefixoDeHost(selected.hostname)}</strong>
                    {selected.txt_verify ? <> e valor <strong className="text-foreground break-all">{selected.txt_verify}</strong>.</> : ' e o valor de verificação exibido pela Lovable.'}
                  </li>
                  <li>Aguarde a propagação DNS e a validação automática do certificado.</li>
                </ol>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Contato que será exibido no portal</p>
                  <p className="mt-2 text-sm text-muted-foreground">{contatoFallback(selected).email}</p>
                  <p className="text-sm text-muted-foreground">{contatoFallback(selected).phoneDisplay}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Indexação</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selected.noindex ? 'Este endereço envia noindex, nofollow aos buscadores.' : 'Este endereço pode ser indexado pelos buscadores.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">A aba organiza os dados, mas não cria registros DNS nem conecta o domínio automaticamente. Essas duas etapas continuam sendo concluídas no registro.br e nas configurações da Lovable.</p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar subdomínio' : 'Novo subdomínio'}</DialogTitle>
            <DialogDescription>Informe os dados que serão usados no portal público e no rodapé de contato.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prefixo">Prefixo do subdomínio</Label>
              <div className="flex items-center gap-2">
                <Input id="prefixo" value={form.prefixo} onChange={(event) => updateForm('prefixo', event.target.value)} placeholder="luizcarlos" required />
                <span className="whitespace-nowrap text-sm text-muted-foreground">.{DOMINIO_BASE}</span>
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="responsavel">Responsável</Label><Input id="responsavel" value={form.responsavel_nome} onChange={(event) => updateForm('responsavel_nome', event.target.value)} placeholder="Nome do responsável" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="telefone">Telefone WhatsApp</Label><Input id="telefone" value={form.telefone} onChange={(event) => updateForm('telefone', event.target.value)} placeholder="5562981474256" required /></div>
              <div className="space-y-2"><Label htmlFor="telefone_display">Telefone para exibição</Label><Input id="telefone_display" value={form.telefone_display} onChange={(event) => updateForm('telefone_display', event.target.value)} placeholder="(62) 98147-4256" required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="contato@exemplo.com.br" required /></div>
             <div className="space-y-2"><Label htmlFor="txt_verify">Valor do registro TXT (verificação Lovable)</Label>
               <Input id="txt_verify" value={form.txt_verify} onChange={(event) => updateForm('txt_verify', event.target.value)} placeholder="lovable_verify=..." />
               <p className="text-xs text-muted-foreground">Copie do fluxo Connect Domain da Lovable. Fica disponível para copiar nas instruções.</p>
             </div>
             <div className="space-y-2"><Label htmlFor="meta_verification">Código da meta tag de verificação Meta</Label>
               <Input id="meta_verification" value={form.meta_verification} onChange={(event) => updateForm('meta_verification', event.target.value)} placeholder="Cole a tag completa ou apenas o código" />
               <p className="text-xs text-muted-foreground">Aceita a tag completa ou somente o código após <code>content=</code>. O sistema salva apenas o código.</p>
             </div>
             <div className="space-y-2"><Label htmlFor="meta_txt_verify">Valor do TXT de verificação Meta</Label>
               <Input id="meta_txt_verify" value={form.meta_txt_verify} onChange={(event) => updateForm('meta_txt_verify', event.target.value)} placeholder="facebook-domain-verification=..." />
               <p className="text-xs text-muted-foreground">Opção recomendada para subdomínios: copie o valor exibido pela Meta e cadastre-o no registro.br.</p>
             </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="text-sm font-medium">Não aparecer em buscas</p><p className="text-xs text-muted-foreground">Envia noindex, nofollow neste subdomínio.</p></div>
              <Switch checked={form.noindex} onCheckedChange={(checked) => updateForm('noindex', checked)} aria-label="Não aparecer em buscas" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar subdomínio'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
