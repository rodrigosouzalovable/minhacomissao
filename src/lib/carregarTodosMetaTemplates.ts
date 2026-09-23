import { supabase } from "@/integrations/supabase/client";

type MetaTemplateFilters = {
  status?: string;
  categoria?: string;
  instanciaId?: string;
  instanciaIds?: string[];
};

const TAMANHO_PAGINA = 1000;

export async function carregarTodosMetaTemplates<T>(
  colunas: string,
  filtros: MetaTemplateFilters = {},
): Promise<T[]> {
  if (filtros.instanciaIds && filtros.instanciaIds.length === 0) return [];

  const todos: T[] = [];
  for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
    let consulta = supabase
      .from("meta_whatsapp_templates")
      .select(colunas)
      .order("nome_template")
      .order("id")
      .range(inicio, inicio + TAMANHO_PAGINA - 1);

    if (filtros.status) consulta = consulta.eq("status", filtros.status);
    if (filtros.categoria) consulta = consulta.eq("categoria", filtros.categoria);
    if (filtros.instanciaId) consulta = consulta.eq("instancia_id", filtros.instanciaId);
    if (filtros.instanciaIds) consulta = consulta.in("instancia_id", filtros.instanciaIds);

    const { data, error } = await consulta;
    if (error) throw error;

    const pagina = (data ?? []) as T[];
    todos.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return todos;
  }
}