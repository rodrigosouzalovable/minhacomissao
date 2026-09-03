import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Copy, Sparkles, Plus, Trash2 } from "lucide-react";

const STATUS = ["rascunho", "cadastrado", "aprovado"] as const;

export function IdeiasTemplatesTab() {
  const qc = useQueryClient();
  const [tema, setTema] = useState("");
  const [categoria, setCategoria] = useState("UTILITY");
  const [novo, setNovo] = useState({ nome_sugerido: "", corpo: "", justificativa: "" });

  const { data: ideias, isLoading } = useQuery({
    queryKey: ["template-ideias"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_template_ideias")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["template-ideias"] });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-template-ideias-gerar", {
        body: { categoria, tema, quantidade: 3 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      return data;
    },
    onSuccess: () => { toast.success("Novas ideias geradas"); invalidar(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar ideias"),
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!novo.nome_sugerido.trim() || !novo.corpo.trim()) throw new Error("Informe nome e corpo");
      const { error } = await supabase.from("meta_template_ideias").insert({
        nome_sugerido: novo.nome_sugerido.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        categoria,
        idioma: "pt_BR",
        corpo: novo.corpo.trim(),
        justificativa: novo.justificativa.trim() || null,
        status: "rascunho",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ideia adicionada");
      setNovo({ nome_sugerido: "", corpo: "", justificativa: "" });
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("meta_template_ideias").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meta_template_ideias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); invalidar(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  const copiar = async (texto: string) => {
    await navigator.clipboard.writeText(texto);
    toast.success("Copiado");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Gerar ideias com IA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UTILITY">UTILITY</SelectItem>
                <SelectItem value="MARKETING">MARKETING</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Tema (ex.: confirmação de atendimento para clínicas)"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
            />
            <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              {gerar.isPending ? "Gerando…" : "Gerar 3 ideias"}
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="nome_do_template"
              value={novo.nome_sugerido}
              onChange={(e) => setNovo({ ...novo, nome_sugerido: e.target.value })}
            />
            <Input
              placeholder="Por que funciona (opcional)"
              value={novo.justificativa}
              onChange={(e) => setNovo({ ...novo, justificativa: e.target.value })}
            />
            <Button variant="outline" onClick={() => criar.mutate()} disabled={criar.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar manual
            </Button>
          </div>
          <Textarea
            placeholder="Corpo do template, use {{1}} para o nome do contato"
            value={novo.corpo}
            onChange={(e) => setNovo({ ...novo, corpo: e.target.value })}
            rows={3}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (ideias ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma ideia ainda. Gere com a IA ou cadastre manualmente.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(ideias as any[]).map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-mono break-all">{t.nome_sugerido}</CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline">{t.categoria}</Badge>
                    <Badge variant={t.status === "aprovado" ? "default" : "secondary"}>{t.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-wrap">{t.corpo}</p>
                {Array.isArray(t.botoes) && t.botoes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {t.botoes.map((b: string, i: number) => (
                      <Badge key={i} variant="outline">{b}</Badge>
                    ))}
                  </div>
                )}
                {t.justificativa && (
                  <p className="text-xs italic text-muted-foreground">{t.justificativa}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copiar(t.corpo)}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar corpo
                  </Button>
                  <Select value={t.status} onValueChange={(v) => mudarStatus.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => remover.mutate(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
