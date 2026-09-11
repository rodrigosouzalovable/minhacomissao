import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useState } from "react";
import { Flame, RefreshCw, Play, Brain, DollarSign, Send, Loader2, Bot, Search, Copy, Download } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { exportarParaExcel } from "@/lib/exportExcel";

const AUTO_RESP_PAGE_SIZE = 10;

function telefoneBr(valor: string) {
  const d = String(valor || "").replace(/\D/g, "");
  const nacional = d.startsWith("55") ? d.slice(2) : d;
  if (nacional.length === 11) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  if (nacional.length === 10) return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  return valor;
}

function hojeBrt() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function AquecimentoMetaTab() {
  const qc = useQueryClient();
  const dia = hojeBrt();
  const [tetoEdit, setTetoEdit] = useState<string>("");
  const [buscaAuto, setBuscaAuto] = useState("");
  const [paginaAuto, setPaginaAuto] = useState(0);

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

  const { data: autoRespondedores, isLoading: carregandoAuto } = useQuery({
    queryKey: ["aq-auto-respondedores", paginaAuto, buscaAuto],
    staleTime: 60_000,
    queryFn: async () => {
      const inicio = paginaAuto * AUTO_RESP_PAGE_SIZE;
      let query = supabase
        .from("meta_aquecimento_auto_respondedores")
        .select("*", { count: "exact" })
        .order("ultima_deteccao_em", { ascending: false })
        .range(inicio, inicio + AUTO_RESP_PAGE_SIZE - 1);
      const termo = buscaAuto.trim().replace(/[,%()]/g, "");
      if (termo) query = query.or(`telefone.ilike.%${termo}%,nome.ilike.%${termo}%,nicho.ilike.%${termo}%,cidade.ilike.%${termo}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { itens: data ?? [], total: count ?? 0 };
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

  const enviarRelatorio = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-maps-leads-relatorio-diario", {
        body: { manual: true },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível enviar o relatório");
      return data;
    },
    onSuccess: (data: any) => {
      const total = Number(data?.acumulado?.mensagens ?? 0);
      toast.success(`Relatório enviado para seu WhatsApp${total ? ` · ${total} mensagens no acumulado` : ""}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar relatório"),
  });

  const copiarAutoRespondedores = async () => {
    const { data, error } = await supabase
      .from("meta_aquecimento_auto_respondedores")
      .select("telefone")
      .order("ultima_deteccao_em", { ascending: false })
      .limit(5000);
    if (error) return toast.error("Não foi possível copiar os telefones");
    await navigator.clipboard.writeText((data ?? []).map((item) => item.telefone).join("\n"));
    toast.success(`${data?.length ?? 0} telefones copiados`);
  };

  const exportarAutoRespondedores = async () => {
    const { data, error } = await supabase
      .from("meta_aquecimento_auto_respondedores")
      .select("telefone, nome, nicho, cidade, quantidade_respostas, ultima_resposta, motivo_classificacao, confianca, primeira_deteccao_em, ultima_deteccao_em")
      .order("ultima_deteccao_em", { ascending: false })
      .limit(5000);
    if (error) return toast.error("Não foi possível preparar o Excel");
    const linhas = (data ?? []).map((item) => ({
      ...item,
      telefone: telefoneBr(item.telefone),
      primeira_deteccao_em: new Date(item.primeira_deteccao_em).toLocaleString("pt-BR"),
      ultima_deteccao_em: new Date(item.ultima_deteccao_em).toLocaleString("pt-BR"),
    }));
    await exportarParaExcel(linhas, [
      { chave: "telefone", titulo: "WhatsApp" },
      { chave: "nome", titulo: "Empresa" },
      { chave: "nicho", titulo: "Nicho" },
      { chave: "cidade", titulo: "Cidade" },
      { chave: "quantidade_respostas", titulo: "Respostas automáticas" },
      { chave: "ultima_resposta", titulo: "Última resposta" },
      { chave: "motivo_classificacao", titulo: "Motivo da classificação" },
      { chave: "confianca", titulo: "Confiança (%)" },
      { chave: "primeira_deteccao_em", titulo: "Primeira detecção" },
      { chave: "ultima_deteccao_em", titulo: "Última detecção" },
    ], "contatos-resposta-automatica");
  };

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
        <Button
          size="sm"
          variant="outline"
          onClick={() => enviarRelatorio.mutate()}
          disabled={enviarRelatorio.isPending}
        >
          {enviarRelatorio.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Enviar relatório no WhatsApp
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" /> Contatos com resposta automática
              <Badge variant="secondary">{autoRespondedores?.total ?? 0}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" title="Copiar telefones" onClick={copiarAutoRespondedores} disabled={!autoRespondedores?.total}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" title="Baixar Excel" onClick={exportarAutoRespondedores} disabled={!autoRespondedores?.total}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar telefone, empresa, nicho ou cidade"
              value={buscaAuto}
              onChange={(event) => { setBuscaAuto(event.target.value); setPaginaAuto(0); }}
            />
          </div>
          {carregandoAuto ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !autoRespondedores?.total ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum contato com resposta automática confirmado ainda.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">WhatsApp</th>
                      <th className="p-2 font-medium">Empresa</th>
                      <th className="p-2 font-medium">Nicho / cidade</th>
                      <th className="p-2 font-medium">Ocorrências</th>
                      <th className="p-2 font-medium">Última resposta</th>
                      <th className="p-2 font-medium">Detectada em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(autoRespondedores.itens as any[]).map((item) => (
                      <tr key={item.id}>
                        <td className="p-2 font-medium whitespace-nowrap">{telefoneBr(item.telefone)}</td>
                        <td className="p-2">{item.nome || "—"}</td>
                        <td className="p-2">{[item.nicho, item.cidade].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="p-2"><Badge variant="outline">{item.quantidade_respostas}</Badge></td>
                        <td className="p-2 max-w-[320px] truncate" title={item.ultima_resposta || ""}>{item.ultima_resposta || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{new Date(item.ultima_deteccao_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{autoRespondedores.total} contatos confirmados</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={paginaAuto === 0} onClick={() => setPaginaAuto((p) => Math.max(0, p - 1))}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={(paginaAuto + 1) * AUTO_RESP_PAGE_SIZE >= autoRespondedores.total} onClick={() => setPaginaAuto((p) => p + 1)}>Próxima</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
