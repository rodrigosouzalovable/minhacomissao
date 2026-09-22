import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type CertificadoTemplate = {
  id: string;
  nome: string;
  idioma: string;
  categoria: string;
  corpo: string;
  ativoCertificado: boolean;
};

type Props = {
  templates: CertificadoTemplate[];
  savingId: string | null;
  onToggle: (template: CertificadoTemplate, ativo: boolean) => void;
};

export function CertificadoTemplatesCard({ templates, savingId, onToggle }: Props) {
  const [busca, setBusca] = useState("");
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return templates.filter((template) => !termo || `${template.nome} ${template.categoria}`.toLowerCase().includes(termo));
  }, [busca, templates]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates do Certificado Digital</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar template" className="pl-9" />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {filtrados.map((template) => (
            <div
              key={template.id}
              className={`flex items-center justify-between gap-3 rounded-md border p-3 transition-opacity ${template.ativoCertificado ? "" : "opacity-50"}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{template.nome}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">{template.categoria}</Badge>
                  <Badge variant="outline" className="text-[10px]">{template.idioma}</Badge>
                  <Badge variant={template.ativoCertificado ? "secondary" : "outline"} className="text-[10px]">
                    {template.ativoCertificado ? "Habilitado" : "Inabilitado"}
                  </Badge>
                </div>
              </div>
              <Switch
                checked={template.ativoCertificado}
                onCheckedChange={(checked) => onToggle(template, checked)}
                disabled={savingId === template.id}
                aria-label={`${template.ativoCertificado ? "Inabilitar" : "Habilitar"} ${template.nome}`}
              />
            </div>
          ))}
          {filtrados.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum template encontrado.</p>}
        </div>
      </CardContent>
    </Card>
  );
}