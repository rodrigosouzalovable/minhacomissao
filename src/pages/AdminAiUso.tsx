import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type LogRow = {
  id: string;
  function_name: string;
  model: string | null;
  prompt_chars: number | null;
  status: string | null;
  created_at: string;
};

type Aggregate = {
  function_name: string;
  calls: number;
  total_chars: number;
};

export default function AdminAiUso() {
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [agg, setAgg] = useState<Aggregate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: cfg }, { data: rows }] = await Promise.all([
        supabase.from("system_config").select("value").eq("key", "ai_enabled").maybeSingle(),
        supabase
          .from("ai_usage_log")
          .select("id, function_name, model, prompt_chars, status, created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      const cfgVal = (cfg as any)?.value;
      setAiEnabled(cfgVal === false || cfgVal === "false" ? false : true);
      const list = (rows ?? []) as LogRow[];
      setLogs(list);
      const map = new Map<string, Aggregate>();
      for (const r of list) {
        const k = r.function_name;
        const cur = map.get(k) ?? { function_name: k, calls: 0, total_chars: 0 };
        cur.calls += 1;
        cur.total_chars += r.prompt_chars ?? 0;
        map.set(k, cur);
      }
      setAgg([...map.values()].sort((a, b) => b.calls - a.calls));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (v: boolean) => {
    const { error } = await supabase
      .from("system_config")
      .upsert({ key: "ai_enabled", value: v as any, updated_at: new Date().toISOString() });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    setAiEnabled(v);
    toast.success(v ? "IA ativada" : "IA desativada — todas as funções de IA bloqueadas");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoramento de IA</h1>
          <p className="text-muted-foreground text-sm">
            Controle e monitore o consumo de Lovable AI em todas as funções.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <Card className={aiEnabled ? "" : "border-destructive"}>
        <CardHeader>
          <CardTitle>Kill Switch Global</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Switch id="ai-kill" checked={aiEnabled} onCheckedChange={toggle} />
            <Label htmlFor="ai-kill" className="text-base">
              {aiEnabled ? (
                <span>
                  IA <Badge variant="default">ATIVA</Badge> — funções podem consumir créditos
                </span>
              ) : (
                <span>
                  IA <Badge variant="destructive">DESATIVADA</Badge> — nenhuma função consome créditos
                </span>
              )}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Quando desativada, todas as funções (mentor, ensinar IA, estratégia, relatório, extração de
            documentos etc.) retornam erro 503 sem chamar o gateway. Ative apenas quando estiver usando.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consumo agregado (últimas 200 chamadas)</CardTitle>
        </CardHeader>
        <CardContent>
          {agg.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas registradas ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Caracteres enviados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agg.map((a) => (
                  <TableRow key={a.function_name}>
                    <TableCell className="font-mono">{a.function_name}</TableCell>
                    <TableCell className="text-right">{a.calls}</TableCell>
                    <TableCell className="text-right">{a.total_chars.toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico recente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Chars</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.function_name}</TableCell>
                  <TableCell className="text-xs">{l.model ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.prompt_chars ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "ok" ? "default" : "destructive"}>
                      {l.status ?? "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
