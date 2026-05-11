import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarDays, Save, Loader2 } from "lucide-react";

interface DiaConfig {
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  pausa_inicio: string | null;
  pausa_fim: string | null;
  fator_volume: number;
  quantidade_status: number;
  ativo: boolean;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function trim(t: string | null): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function AquecimentoCalendarioTab() {
  const [rows, setRows] = useState<DiaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_aquecimento_calendario" as any)
      .select("*")
      .order("dia_semana");
    setRows((data as any as DiaConfig[]) || []);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const salvar = async (dia: DiaConfig) => {
    setSaving(dia.dia_semana);
    const { error } = await supabase
      .from("whatsapp_aquecimento_calendario" as any)
      .update({
        horario_inicio: dia.horario_inicio,
        horario_fim: dia.horario_fim,
        pausa_inicio: dia.pausa_inicio || null,
        pausa_fim: dia.pausa_fim || null,
        fator_volume: dia.fator_volume,
        quantidade_status: dia.quantidade_status,
        ativo: dia.ativo,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("dia_semana", dia.dia_semana);
    setSaving(null);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success(`${DIAS[dia.dia_semana]} salvo`);
  };

  const upd = (idx: number, patch: Partial<DiaConfig>) => {
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Calendário de Comportamento (Anti-padrão)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Define janela horária, pausa de almoço, fator de volume e quantidade de status por dia da semana.
          Substitui valores hardcoded em todas as edge functions de aquecimento.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Pausa Início</TableHead>
                <TableHead>Pausa Fim</TableHead>
                <TableHead>Fator Volume</TableHead>
                <TableHead>Qtd Status</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d, i) => (
                <TableRow key={d.dia_semana}>
                  <TableCell className="font-medium">{DIAS[d.dia_semana]}</TableCell>
                  <TableCell>
                    <Input type="time" value={trim(d.horario_inicio)} onChange={(e) => upd(i, { horario_inicio: e.target.value + ":00" })} className="w-28" />
                  </TableCell>
                  <TableCell>
                    <Input type="time" value={trim(d.horario_fim)} onChange={(e) => upd(i, { horario_fim: e.target.value + ":00" })} className="w-28" />
                  </TableCell>
                  <TableCell>
                    <Input type="time" value={trim(d.pausa_inicio)} onChange={(e) => upd(i, { pausa_inicio: e.target.value ? e.target.value + ":00" : null })} className="w-28" />
                  </TableCell>
                  <TableCell>
                    <Input type="time" value={trim(d.pausa_fim)} onChange={(e) => upd(i, { pausa_fim: e.target.value ? e.target.value + ":00" : null })} className="w-28" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.05" min="0" max="2" value={d.fator_volume} onChange={(e) => upd(i, { fator_volume: parseFloat(e.target.value) || 0 })} className="w-20" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" max="10" value={d.quantidade_status} onChange={(e) => upd(i, { quantidade_status: parseInt(e.target.value) || 0 })} className="w-20" />
                  </TableCell>
                  <TableCell>
                    <Switch checked={d.ativo} onCheckedChange={(v) => upd(i, { ativo: v })} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => salvar(d)} disabled={saving === d.dia_semana}>
                      {saving === d.dia_semana ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <p><strong>Fator volume:</strong> 1.0 = 100% do limite, 0.4 = 40% (domingo), 1.1 = 110% (sexta).</p>
          <p><strong>Pausa:</strong> deixe vazio para não ter pausa de almoço naquele dia.</p>
          <p><strong>Qtd status:</strong> quantidade máxima de stories postados naquele dia (0 = nenhum).</p>
        </div>
      </CardContent>
    </Card>
  );
}
