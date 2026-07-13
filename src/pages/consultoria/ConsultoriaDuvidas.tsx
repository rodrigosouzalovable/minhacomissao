import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoria } from "@/hooks/useConsultoria";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ConsultoriaDuvidas() {
  const { aluno } = useConsultoria();
  const qc = useQueryClient();
  const [pergunta, setPergunta] = useState("");
  const [moduloId, setModuloId] = useState<string>("");
  const [enviando, setEnviando] = useState(false);

  const { data: modulos = [] } = useQuery({
    queryKey: ["consultoria-modulos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultoria_modulos")
        .select("id, titulo")
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: duvidas = [] } = useQuery({
    queryKey: ["consultoria-duvidas", aluno?.id],
    queryFn: async () => {
      if (!aluno) return [];
      const { data } = await (supabase as any)
        .from("consultoria_duvidas")
        .select("*")
        .eq("aluno_id", aluno.id)
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
    enabled: !!aluno,
  });

  async function enviar() {
    if (!aluno) return toast.error("Você precisa estar cadastrado como aluno.");
    if (pergunta.trim().length < 5) return toast.error("Escreva uma pergunta mais detalhada.");
    setEnviando(true);
    const { error } = await (supabase as any).from("consultoria_duvidas").insert({
      aluno_id: aluno.id,
      modulo_id: moduloId ? Number(moduloId) : null,
      pergunta: pergunta.trim(),
    });
    setEnviando(false);
    if (error) return toast.error(error.message);
    setPergunta("");
    setModuloId("");
    toast.success("Pergunta enviada!");
    qc.invalidateQueries({ queryKey: ["consultoria-duvidas"] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dúvidas</h1>
        <p className="text-muted-foreground">Envie perguntas e acompanhe as respostas.</p>
      </header>

      {aluno && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova pergunta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Módulo (opcional)</Label>
              <Select value={moduloId} onValueChange={setModuloId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar módulo" />
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
            <div className="space-y-2">
              <Label>Sua pergunta</Label>
              <Textarea
                rows={4}
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                placeholder="Descreva sua dúvida com o máximo de detalhes..."
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={enviar} disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar pergunta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {duvidas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Você ainda não enviou nenhuma pergunta.
            </div>
          ) : (
            duvidas.map((d: any) => (
              <div key={d.id} className="border rounded-md p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={d.status === "respondida" ? "default" : "secondary"}>
                    {d.status === "respondida" ? "Respondida" : "Pendente"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(d.criado_em), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Pergunta:</span> {d.pergunta}
                </div>
                {d.resposta && (
                  <div className="text-sm bg-muted/50 rounded p-3 whitespace-pre-wrap">
                    <span className="font-medium">Resposta:</span> {d.resposta}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
