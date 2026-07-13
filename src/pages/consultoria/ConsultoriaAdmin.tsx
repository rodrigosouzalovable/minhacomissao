import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoria } from "@/hooks/useConsultoria";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  UploadCloud,
  Pencil,
  Save,
  X,
  ExternalLink,
} from "lucide-react";

export default function ConsultoriaAdmin() {
  const { isAdmin, loading } = useConsultoria();
  if (loading) return <div>Carregando...</div>;
  if (!isAdmin) return <div className="text-muted-foreground">Sem permissão.</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel administrativo</h1>
        <p className="text-muted-foreground">Gerencie alunos, aulas, materiais e dúvidas.</p>
      </header>

      <Tabs defaultValue="alunos">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="alunos">Alunos</TabsTrigger>
          <TabsTrigger value="aulas">Aulas</TabsTrigger>
          <TabsTrigger value="materiais">Materiais</TabsTrigger>
          <TabsTrigger value="duvidas">Dúvidas</TabsTrigger>
        </TabsList>
        <TabsContent value="alunos">
          <AlunosTab />
        </TabsContent>
        <TabsContent value="aulas">
          <AulasTab />
        </TabsContent>
        <TabsContent value="materiais">
          <MateriaisTab />
        </TabsContent>
        <TabsContent value="duvidas">
          <DuvidasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ==================== ALUNOS ==================== */
function AlunosTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    empresa: "",
    telefone: "",
    is_admin_consultoria: false,
  });
  const [saving, setSaving] = useState(false);

  const { data: alunos = [] } = useQuery({
    queryKey: ["admin-consultoria-alunos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_alunos")
        .select("*")
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
  });

  async function criar() {
    if (!form.nome || !form.email || form.senha.length < 6)
      return toast.error("Preencha nome, e-mail e senha (mínimo 6 caracteres).");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("create-consultoria-aluno", {
      body: form,
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error ?? error?.message ?? "Falha ao criar aluno");
    }
    toast.success("Aluno criado!");
    setForm({
      nome: "",
      email: "",
      senha: "",
      empresa: "",
      telefone: "",
      is_admin_consultoria: false,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-consultoria-alunos"] });
  }

  async function toggleAtivo(a: any) {
    await (supabase as any)
      .from("consultoria_alunos")
      .update({ ativo: !a.ativo })
      .eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["admin-consultoria-alunos"] });
  }

  async function remover(a: any) {
    if (!confirm(`Remover ${a.nome}?`)) return;
    await (supabase as any).from("consultoria_alunos").delete().eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["admin-consultoria-alunos"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{alunos.length} alunos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" /> Novo aluno
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar aluno</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Senha inicial</Label>
                  <Input
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Empresa</Label>
                  <Input
                    value={form.empresa}
                    onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_admin_consultoria}
                  onCheckedChange={(v) => setForm({ ...form, is_admin_consultoria: v })}
                />
                <Label>Admin da consultoria</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={criar} disabled={saving}>
                {saving ? "Salvando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {alunos.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{a.nome}</span>
                  {a.is_admin_consultoria && <Badge variant="secondary">Admin</Badge>}
                  {!a.ativo && <Badge variant="destructive">Inativo</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {a.email} {a.empresa && `· ${a.empresa}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={a.ativo} onCheckedChange={() => toggleAtivo(a)} />
                <Button variant="ghost" size="icon" onClick={() => remover(a)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {alunos.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum aluno cadastrado ainda.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ==================== AULAS ==================== */
function AulasTab() {
  const qc = useQueryClient();
  const [selMod, setSelMod] = useState<number>(1);
  const [editing, setEditing] = useState<any | null>(null);
  const [preview, setPreview] = useState(false);

  const { data: modulos = [] } = useQuery({
    queryKey: ["consultoria-modulos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_modulos")
        .select("*")
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: aulas = [] } = useQuery({
    queryKey: ["admin-aulas", selMod],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_aulas")
        .select("*")
        .eq("modulo_id", selMod)
        .order("ordem");
      return data ?? [];
    },
  });

  async function salvar() {
    if (!editing) return;
    const { error } = await (supabase as any)
      .from("consultoria_aulas")
      .update({
        titulo: editing.titulo,
        conteudo_md: editing.conteudo_md,
        video_url: editing.video_url || null,
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Aula salva");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-aulas"] });
    qc.invalidateQueries({ queryKey: ["consultoria-aulas"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle className="text-base">Editar aulas</CardTitle>
        <Select value={String(selMod)} onValueChange={(v) => setSelMod(Number(v))}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modulos.map((m: any) => (
              <SelectItem key={m.id} value={String(m.id)}>
                Módulo {m.id} — {m.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-2">
        {aulas.map((a: any) => (
          <div key={a.id} className="border rounded-md">
            <div className="flex items-center justify-between p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {selMod}.{a.numero} — {a.titulo}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(a);
                  setPreview(false);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </Button>
            </div>
            {editing?.id === a.id && (
              <div className="border-t p-3 space-y-3">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={editing.titulo}
                    onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                  />
                </div>
                <div>
                  <Label>URL do vídeo (opcional — YouTube ou MP4)</Label>
                  <Input
                    value={editing.video_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Conteúdo (Markdown)</Label>
                    <div className="flex items-center gap-2 text-xs">
                      <Switch checked={preview} onCheckedChange={setPreview} />
                      Preview
                    </div>
                  </div>
                  {preview ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none border rounded-md p-3 min-h-[300px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editing.conteudo_md}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <Textarea
                      rows={16}
                      className="font-mono text-xs"
                      value={editing.conteudo_md}
                      onChange={(e) => setEditing({ ...editing, conteudo_md: e.target.value })}
                    />
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                    <X className="w-4 h-4 mr-2" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={salvar}>
                    <Save className="w-4 h-4 mr-2" /> Salvar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ==================== MATERIAIS ==================== */
function MateriaisTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    modulo_id: "1",
    tipo: "pdf",
    nome: "",
    descricao: "",
    url_externa: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: modulos = [] } = useQuery({
    queryKey: ["consultoria-modulos"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("consultoria_modulos").select("*").order("ordem");
      return data ?? [];
    },
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ["admin-materiais"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_materiais")
        .select("*")
        .order("modulo_id")
        .order("ordem");
      return data ?? [];
    },
  });

  async function adicionar() {
    if (!form.nome) return toast.error("Informe o nome");
    if (!file && !form.url_externa) return toast.error("Envie um arquivo ou informe URL externa");
    setUploading(true);
    let storage_path: string | null = null;
    if (file) {
      const path = `${form.modulo_id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("consultoria-materiais")
        .upload(path, file);
      if (error) {
        setUploading(false);
        return toast.error(error.message);
      }
      storage_path = path;
    }
    const { error } = await (supabase as any).from("consultoria_materiais").insert({
      modulo_id: Number(form.modulo_id),
      tipo: form.tipo,
      nome: form.nome,
      descricao: form.descricao || null,
      storage_path,
      url_externa: form.url_externa || null,
    });
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Material adicionado");
    setForm({ modulo_id: "1", tipo: "pdf", nome: "", descricao: "", url_externa: "" });
    setFile(null);
    qc.invalidateQueries({ queryKey: ["admin-materiais"] });
    qc.invalidateQueries({ queryKey: ["consultoria-materiais-all"] });
    qc.invalidateQueries({ queryKey: ["consultoria-materiais-mod"] });
  }

  async function remover(m: any) {
    if (!confirm(`Remover ${m.nome}?`)) return;
    if (m.storage_path) {
      await supabase.storage.from("consultoria-materiais").remove([m.storage_path]);
    }
    await (supabase as any).from("consultoria_materiais").delete().eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["admin-materiais"] });
  }

  async function abrir(m: any) {
    if (m.url_externa) return window.open(m.url_externa, "_blank");
    if (m.storage_path) {
      const { data } = await supabase.storage
        .from("consultoria-materiais")
        .createSignedUrl(m.storage_path, 600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo material</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Módulo</Label>
              <Select
                value={form.modulo_id}
                onValueChange={(v) => setForm({ ...form, modulo_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modulos.map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      Módulo {m.id} — {m.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="planilha">Planilha</SelectItem>
                  <SelectItem value="checklist">Checklist</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Arquivo (upload)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>Ou URL externa</Label>
              <Input
                placeholder="https://..."
                value={form.url_externa}
                onChange={(e) => setForm({ ...form, url_externa: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={adicionar} disabled={uploading}>
              <UploadCloud className="w-4 h-4 mr-2" />
              {uploading ? "Enviando..." : "Adicionar material"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{materiais.length} materiais</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {materiais.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <Badge variant="outline">M{m.modulo_id}</Badge>
                <Badge variant="secondary">{m.tipo}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.nome}</div>
                  {m.descricao && (
                    <div className="text-xs text-muted-foreground truncate">{m.descricao}</div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => abrir(m)}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remover(m)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
            {materiais.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum material cadastrado ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ==================== DÚVIDAS ==================== */
function DuvidasTab() {
  const qc = useQueryClient();
  const [respondendo, setRespondendo] = useState<Record<string, string>>({});

  const { data: duvidas = [] } = useQuery({
    queryKey: ["admin-duvidas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_duvidas")
        .select("*, aluno:consultoria_alunos(nome, email)")
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
  });

  async function responder(d: any) {
    const r = (respondendo[d.id] ?? "").trim();
    if (r.length < 3) return toast.error("Escreva uma resposta");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("consultoria_duvidas")
      .update({
        resposta: r,
        status: "respondida",
        respondido_em: new Date().toISOString(),
        respondido_por: userData.user?.id ?? null,
      })
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Resposta enviada");
    setRespondendo((s) => {
      const c = { ...s };
      delete c[d.id];
      return c;
    });
    qc.invalidateQueries({ queryKey: ["admin-duvidas"] });
    qc.invalidateQueries({ queryKey: ["consultoria-duvidas"] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dúvidas dos alunos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {duvidas.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma dúvida no momento.
          </div>
        ) : (
          duvidas.map((d: any) => (
            <div key={d.id} className="border rounded-md p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {d.aluno?.nome ?? "Aluno"}{" "}
                  <span className="text-xs text-muted-foreground">· {d.aluno?.email}</span>
                </div>
                <Badge variant={d.status === "respondida" ? "default" : "secondary"}>
                  {d.status === "respondida" ? "Respondida" : "Pendente"}
                </Badge>
              </div>
              <div className="text-sm">
                <span className="font-medium">Pergunta:</span> {d.pergunta}
              </div>
              {d.resposta ? (
                <div className="text-sm bg-muted/50 rounded p-3 whitespace-pre-wrap">
                  <span className="font-medium">Resposta:</span> {d.resposta}
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    placeholder="Escreva a resposta..."
                    value={respondendo[d.id] ?? ""}
                    onChange={(e) =>
                      setRespondendo((s) => ({ ...s, [d.id]: e.target.value }))
                    }
                  />
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => responder(d)}>
                      Responder
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
