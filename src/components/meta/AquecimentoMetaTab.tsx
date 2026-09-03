import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import { Flame, RefreshCw, Play, Brain, DollarSign } from "lucide-react";
import { Switch } from "@/components/ui/switch";

function hojeBrt() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function AquecimentoMetaTab() {
  const qc = useQueryClient();
  const dia = hojeBrt();
  const [tetoEdit, setTetoEdit] = useState<string>("");

  const { data: trilhas, isLoading } = useQuery({
    queryKey: ["aq-trilhas", dia],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_aquecimento_trilha")
        .select("*, instancia:meta_whatsapp_instances(nome, display_phone, saude_quality, saude_tier, tier_diario)")
        .eq("dia", dia);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: orcamento } = useQuery({
    queryKey: ["aq-orcamento", dia],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_aquecimento_orcamento").select("*").eq("dia", dia).maybeSingle();
      return data;
    },
  });

  const { data: nichos } = useQuery({
    queryKey: ["aq-nichos"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("aquecimento_nicho_score")
        .select("*")
        .order("score", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["aq-logs", dia],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_aquecimento_destino_log")
        .select("*")
        .order("enviado_em", { ascending: false })
        .limit(40);
      return data ?? [];
    },
  });

  const { data: selecionadas } = useQuery({
    queryKey: ["aq-selecao"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_whatsapp_instances")
        .select("id, nome, display_phone, saude_quality, saude_tier, tier_diario, aquecimento_meta_ativo")
        .eq("provider", "meta")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const alternarSelecao = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      const { error } = await supabase
        .from("meta_whatsapp_instances")
        .update({ aquecimento_meta_ativo: valor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aq-selecao"] });
      qc.invalidateQueries({ queryKey: ["aq-trilhas", dia] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const rodar = useMutation({
    mutationFn: async (fn: string) => {
      const { data, error } = await supabase.functions.invoke(fn, { body: { forcar: true } });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.skipped ? `Nada a fazer: ${d.skipped}` : "Executado com sucesso");
      qc.invalidateQueries({ queryKey: ["aq-trilhas", dia] });
      qc.invalidateQueries({ queryKey: ["aq-logs", dia] });
      qc.invalidateQueries({ queryKey: ["aq-orcamento", dia] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao executar"),
  });

  const salvarTeto = useMutation({
    mutationFn: async () => {
      const valor = Number(tetoEdit.replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe um valor válido");
      const { error } = await supabase
        .from("meta_aquecimento_orcamento")
        .upsert({ dia, teto_reais: valor }, { onConflict: "dia" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento do dia atualizado");
      setTetoEdit("");
      qc.invalidateQueries({ queryKey: ["aq-orcamento", dia] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const gasto = Number(orcamento?.gasto_reais ?? 0);
  const teto = Number(orcamento?.teto_reais ?? 50);
  const enviadosHoje = (logs ?? []).filter((l: any) => l.dia === dia && l.status !== "falha").length;
  const respondidos = (logs ?? []).filter((l: any) => l.respondeu_em).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => rodar.mutate("meta-aquecimento-planejar")} disabled={rodar.isPending}>
          <Brain className="h-4 w-4 mr-1" /> Planejar agora (IA)
        </Button>
        <Button size="sm" variant="outline" onClick={() => rodar.mutate("meta-aquecimento-tick")} disabled={rodar.isPending}>
          <Play className="h-4 w-4 mr-1" /> Disparar ciclo
        </Button>
        <Button size="sm" variant="outline" onClick={() => rodar.mutate("meta-aquecimento-aprender")} disabled={rodar.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" /> Recalcular nichos
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4" /> Números em aquecimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Só os números marcados aqui entram no motor de aquecimento de tier. Nada é aquecido (nem gasto) enquanto nenhum estiver marcado.
          </p>
          {(selecionadas ?? []).filter((i: any) => i.aquecimento_meta_ativo).length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Nenhum número selecionado — o motor está parado. Marque os números das novas BMs abaixo.
            </div>
          )}
          <div className="divide-y rounded-md border">
            {(selecionadas ?? []).map((i: any) => (
              <div key={i.id} className="flex items-center justify-between gap-3 p-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i.nome || i.display_phone}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.display_phone} · {String(i.saude_quality || "UNKNOWN")} · {i.tier_diario ?? "-"}/dia
                  </div>
                </div>
                <Switch
                  checked={!!i.aquecimento_meta_ativo}
                  disabled={alternarSelecao.isPending}
                  onCheckedChange={(v) => alternarSelecao.mutate({ id: i.id, valor: v })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Gasto de hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold">
              R$ {gasto.toFixed(2)} <span className="text-sm text-muted-foreground">/ R$ {teto.toFixed(2)}</span>
            </div>
            <Progress value={teto > 0 ? Math.min(100, (gasto / teto) * 100) : 0} />
            <div className="flex gap-2">
              <Input
                className="h-8"
                placeholder="Novo teto (R$)"
                value={tetoEdit}
                onChange={(e) => setTetoEdit(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={() => salvarTeto.mutate()} disabled={salvarTeto.isPending}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Envios recentes</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{enviadosHoje}</div>
            <p className="text-xs text-muted-foreground">hoje, entre UAZAPI e leads reais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Respostas no log</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{respondidos}</div>
            <p className="text-xs text-muted-foreground">últimas 40 mensagens registradas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4" /> Trilha por número (hoje)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (trilhas ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma trilha planejada para hoje. Use "Planejar agora (IA)".
            </p>
          ) : (
            <div className="space-y-3">
              {(trilhas as any[]).map((t) => {
                const feitos = (logs ?? []).filter(
                  (l: any) => l.instancia_id === t.instancia_id && l.dia === dia && l.status !== "falha",
                ).length;
                const alvo = Number(t.alvo_unicos_dia ?? 0);
                return (
                  <div key={t.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-sm">
                        {t.instancia?.nome || t.instancia?.display_phone || t.instancia_id}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t.instancia?.saude_quality ?? "—"}</Badge>
                        <Badge variant="secondary">tier {t.tier_atual} → {t.tier_alvo}</Badge>
                        <Badge variant={t.status === "ativa" ? "default" : "outline"}>{t.status}</Badge>
                      </div>
                    </div>
                    <Progress value={alvo > 0 ? Math.min(100, (feitos / alvo) * 100) : 0} />
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>{feitos}/{alvo} destinatários hoje</span>
                      <span>únicos 7d: {t.unicos_7d ?? 0}</span>
                      <span>mix: {t.mix_uazapi_pct}% UAZAPI / {t.mix_leads_pct}% leads</span>
                    </div>
                    {t.decisao_ia?.observacao && (
                      <p className="text-xs italic text-muted-foreground">IA: {t.decisao_ia.observacao}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking de nichos</CardTitle></CardHeader>
          <CardContent>
            {(nichos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem dados de aprendizado.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {(nichos as any[]).map((n) => (
                  <div key={n.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {n.nicho}{n.cidade ? ` — ${n.cidade}` : ""}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {n.respostas}/{n.envios} resp.
                      </span>
                      {n.bloqueado ? (
                        <Badge variant="destructive">bloqueado</Badge>
                      ) : (
                        <Badge variant="outline">{Number(n.score ?? 0).toFixed(0)}</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Últimos envios de aquecimento</CardTitle></CardHeader>
          <CardContent>
            {(logs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
            ) : (
              <div className="space-y-1 text-xs">
                {(logs as any[]).map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {new Date(l.enviado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                      · {l.fonte} · {l.destino_telefone}
                      {l.nicho ? ` (${l.nicho})` : ""}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {l.respondeu_em && <Badge variant="default">respondeu</Badge>}
                      <Badge variant={l.status === "falha" ? "destructive" : "outline"}>{l.status}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
