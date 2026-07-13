import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaterialItem } from "./ConsultoriaModulo";

export default function ConsultoriaMateriais() {
  const [modulo, setModulo] = useState<string>("todos");

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

  const { data: materiais = [] } = useQuery({
    queryKey: ["consultoria-materiais-all", modulo],
    queryFn: async () => {
      let q = (supabase as any).from("consultoria_materiais").select("*").order("modulo_id").order("ordem");
      if (modulo !== "todos") q = q.eq("modulo_id", Number(modulo));
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Materiais de apoio</h1>
          <p className="text-muted-foreground">PDFs, planilhas, checklists e links úteis.</p>
        </div>
        <Select value={modulo} onValueChange={setModulo}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os módulos</SelectItem>
            {modulos.map((m: any) => (
              <SelectItem key={m.id} value={String(m.id)}>
                Módulo {m.id} — {m.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      {materiais.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum material disponível{modulo !== "todos" ? " neste módulo" : ""} ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {materiais.length} {materiais.length === 1 ? "material" : "materiais"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {materiais.map((m: any) => (
              <MaterialItem key={m.id} m={m} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
