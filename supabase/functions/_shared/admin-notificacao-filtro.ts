// Filtro de tipos de aviso do admin.
// `tipos_permitidos` (lista branca) e `tipos_bloqueados` (lista negra) ficam em
// admin_notificacoes_config e são aplicados no processador da fila — um único ponto
// para todos os avisos, assim o admin desliga um relatório sem tocar no código.
// A lista negra vence a lista branca.

export type ConfigNotificacoes = {
  tipos_permitidos?: string[] | null;
  tipos_bloqueados?: string[] | null;
};

export function notificacaoBloqueada(
  cfg: ConfigNotificacoes | null | undefined,
  tipo: string,
): boolean {
  const bloqueados = Array.isArray(cfg?.tipos_bloqueados) ? (cfg!.tipos_bloqueados as string[]) : [];
  if (bloqueados.includes(tipo)) return true;

  const permitidos =
    Array.isArray(cfg?.tipos_permitidos) && cfg!.tipos_permitidos.length
      ? (cfg!.tipos_permitidos as string[])
      : null;
  if (permitidos !== null && !permitidos.includes(tipo)) return true;

  return false;
}
