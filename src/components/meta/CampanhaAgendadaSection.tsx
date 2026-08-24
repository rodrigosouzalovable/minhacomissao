import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "lucide-react";

export type AgendamentoState = {
  ativo: boolean;
  /** YYYY-MM-DD (hora local do navegador) */
  data: string;
  /** HH:MM */
  hora: string;
};

function amanha(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function hojeYMD(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

/** Converte data+hora locais em ISO UTC. Retorna null se inválido. */
export function agendamentoParaISO(s: AgendamentoState): string | null {
  if (!s.ativo || !s.data || !s.hora) return null;
  const dt = new Date(`${s.data}T${s.hora}:00`);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

type Props = {
  value: AgendamentoState;
  onChange: (s: AgendamentoState) => void;
  disabled?: boolean;
};

export function AgendarCampanhaBox({ value, onChange, disabled }: Props) {
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    if (value.ativo && !inicializado && (!value.data || !value.hora)) {
      onChange({ ativo: true, data: value.data || amanha(), hora: value.hora || "08:00" });
      setInicializado(true);
    }
    if (!value.ativo) setInicializado(false);
  }, [value, inicializado, onChange]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Agendar campanha
            </CardTitle>
            <CardDescription>
              Em vez de disparar agora, escolha o dia e a hora em que a campanha deve começar. Nada é enviado antes disso.
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap">
            <Switch
              checked={value.ativo}
              onCheckedChange={(v) => onChange({ ...value, ativo: v })}
              disabled={disabled}
            />
            <span>Agendar em vez de disparar agora</span>
          </label>
        </div>
      </CardHeader>
      {value.ativo && (
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input
                type="date"
                min={hojeYMD()}
                value={value.data}
                onChange={(e) => onChange({ ...value, data: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora de início</Label>
              <Input
                type="time"
                value={value.hora}
                onChange={(e) => onChange({ ...value, hora: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A campanha ficará registrada e começará sozinha no dia e hora escolhidos, respeitando a janela de envio
            (08h–19h, sem domingos). Se o horário cair fora da janela, o início ocorre na próxima abertura.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
