import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

type Aggregate = { function_name: string; calls: number; total_chars: number };

type BudgetCfg = {
  id: number;
  daily_limit_calls: number;
  daily_limit_chars: number;
  hourly_limit_calls: number;
  alert_phone: string;
  alert_threshold_pct: number;
  auto_block_on_limit: boolean;
};

export default function AdminAiUso() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [agg, setAgg] = useState<Aggregate[]>([]);
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<BudgetCfg | null>(null);
  const [todayCalls, setTodayCalls] = useState(0);
  const [todayChars, setTodayChars] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const [{ data: ksw }, { data: rows }, { data: bud }, { data: dayRows }, { data: al }] = await Promise.all([
        supabase.from("system_config").select("value").eq("key", "ai_enabled").maybeSingle(),
        supabase.from("ai_usage_log").select("id, function_name, model, prompt_chars, status, created_at").order("created_at", { ascending: false }).limit(200),
        supabase.from("ai_budget_config").select("*").eq("id", 1).maybeSingle(),
        supabase.from("ai_usage_log").select("prompt_chars, status").gte("created_at", dayStart.toISOString()).eq("status", "ok"),
        supabase.from("ai_alerts_sent").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      const cfgVal = (ksw as any)?.value;
      setAiEnabled(cfgVal === false || cfgVal === "false" ? false : true);
      const list = (rows ?? []) as LogRow[];
      setLogs(list);
      setCfg(bud as any);
      setTodayCalls(dayRows?.length ?? 0);
      setTodayChars((dayRows ?? []).reduce((s: number, r: any) => s + (r.prompt_chars ?? 0), 0));
      setAlerts(al ?? []);
      const map = new Map<string, Aggregate>();
      for (const r of list) {
        const cur = map.get(r.function_name) ?? { function_name: r.function_name, calls: 0, total_chars: 0 };
        cur.calls += 1;
        cur.total_chars += r.prompt_chars ?? 0;
        map.set(r.function_name, cur);
      }
      setAgg([...map.values()].sort((a, b) => b.calls - a.calls));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (v: boolean) => {
    const { error } = await supabase.from("system_config").upsert({ key: "ai_enabled", value: v as any, updated_at: new Date().toISOString() });
    if (error) return toast.error("Erro: " + error.message);
    setAiEnabled(v);
    toast.success(v ? "IA ativada" : "IA desativada");
  };

  const saveBudget = async () => {
    if (!cfg) return;
    const { error } = await supabase.from("ai_budget_config").update({
      daily_limit_calls: cfg.daily_limit_calls,
      daily_limit_chars: cfg.daily_limit_chars,
      hourly_limit_calls: cfg.hourly_limit_calls,
      alert_phone: cfg.alert_phone,
      alert_threshold_pct: cfg.alert_threshold_pct,
      auto_block_on_limit: cfg.auto_block_on_limit,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Orçamento salvo");
  };

  const callsPct = cfg ? Math.min(100, (todayCalls / cfg.daily_limit_calls) * 100) : 0;
  const charsPct = cfg ? Math.min(100, (todayChars / cfg.daily_limit_chars) * 100) : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitoramento de IA</h1>
          <p className="text-muted-foreground text-sm">Controle, limite e receba alertas WhatsApp do consumo de IA.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>Atualizar</Button>
      </div>

      <Card className={aiEnabled ? "" : "border-destructive"}>
        <CardHeader><CardTitle>Kill Switch Global</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Switch id="ai-kill" checked={aiEnabled} onCheckedChange={toggle} />
            <Label htmlFor="ai-kill" className="text-base">
              IA <Badge variant={aiEnabled ? "default" : "destructive"}>{aiEnabled ? "ATIVA" : "DESATIVADA"}</Badge>
            </Label>
          </div>
        </CardContent>
      </Card>

      {cfg && (
        <Card>
          <CardHeader><CardTitle>Orçamento diário e alertas WhatsApp</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Chamadas hoje</span>
                <span className={callsPct >= 100 ? "text-destructive font-semibold" : callsPct >= cfg.alert_threshold_pct ? "text-amber-600 font-semibold" : ""}>
                  {todayCalls} / {cfg.daily_limit_calls} ({callsPct.toFixed(0)}%)
                </span>
              </div>
              <Progress value={callsPct} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Caracteres enviados hoje</span>
                <span className={charsPct >= 100 ? "text-destructive font-semibold" : charsPct >= cfg.alert_threshold_pct ? "text-amber-600 font-semibold" : ""}>
                  {(todayChars/1000).toFixed(1)}k / {(cfg.daily_limit_chars/1000).toFixed(0)}k ({charsPct.toFixed(0)}%)
                </span>
              </div>
              <Progress value={charsPct} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label>Limite diário (chamadas)</Label>
                <Input type="number" value={cfg.daily_limit_calls} onChange={(e) => setCfg({ ...cfg, daily_limit_calls: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Limite diário (caracteres)</Label>
                <Input type="number" value={cfg.daily_limit_chars} onChange={(e) => setCfg({ ...cfg, daily_limit_chars: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Limite por hora (anti-pico)</Label>
                <Input type="number" value={cfg.hourly_limit_calls} onChange={(e) => setCfg({ ...cfg, hourly_limit_calls: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>% para alerta preventivo</Label>
                <Input type="number" value={cfg.alert_threshold_pct} onChange={(e) => setCfg({ ...cfg, alert_threshold_pct: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="md:col-span-2">
                <Label>WhatsApp para alertas (com DDD, sem +55)</Label>
                <Input value={cfg.alert_phone} onChange={(e) => setCfg({ ...cfg, alert_phone: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Switch checked={cfg.auto_block_on_limit} onCheckedChange={(v) => setCfg({ ...cfg, auto_block_on_limit: v })} />
                <Label>Bloquear automaticamente ao atingir 100% do limite</Label>
              </div>
            </div>
            <Button onClick={saveBudget}>Salvar configuração</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Alertas enviados (últimos 20)</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta enviado.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Tipo</TableHead><TableHead>Função</TableHead><TableHead>Telefone</TableHead></TableRow></TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant={a.alert_type.includes("blocked") ? "destructive" : "secondary"}>{a.alert_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{a.function_name || "—"}</TableCell>
                    <TableCell className="text-xs">{a.phone}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consumo agregado (últimas 200 chamadas)</CardTitle></CardHeader>
        <CardContent>
          {agg.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem chamadas registradas ainda.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Função</TableHead><TableHead className="text-right">Chamadas</TableHead><TableHead className="text-right">Caracteres</TableHead></TableRow></TableHeader>
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
        <CardHeader><CardTitle>Histórico recente</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Função</TableHead><TableHead>Modelo</TableHead><TableHead>Chars</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="font-mono text-xs">{l.function_name}</TableCell>
                  <TableCell className="text-xs">{l.model ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.prompt_chars ?? "—"}</TableCell>
                  <TableCell><Badge variant={l.status === "ok" ? "default" : "destructive"}>{l.status ?? "—"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
