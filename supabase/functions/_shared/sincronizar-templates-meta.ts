type SupabaseClientLike = any;

type MetaTemplate = {
  name?: string;
  language?: string;
  category?: string;
  status?: string;
  components?: Array<Record<string, any>>;
};

export type TemplateSyncResult = {
  success: boolean;
  synced: number;
  pages: number;
  error?: string;
  code?: number;
  retryable?: boolean;
};

const MAX_GRAPH_PAGES = 20;
const UPSERT_BATCH_SIZE = 100;

function extractVariables(bodyText: string): Record<string, string> {
  const matches = Array.from(bodyText.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*|\d+)\s*\}\}/g));
  const variables: Record<string, string> = {};
  for (const match of matches) variables[match[1]] = "";
  return variables;
}

function extractTemplateMetadata(components: Array<Record<string, any>>): Record<string, any> {
  const metadata: Record<string, any> = { _components: components };
  const header = components.find((component) => component?.type === "HEADER");
  if (header?.format) metadata._header_format = String(header.format).toUpperCase();
  return metadata;
}

function chunks<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

export async function sincronizarTemplatesMeta(
  supabase: SupabaseClientLike,
  instancia: { id: string; waba_id: string | null; access_token: string | null },
): Promise<TemplateSyncResult> {
  if (!instancia.waba_id || !instancia.access_token) {
    return { success: false, synced: 0, pages: 0, error: "WABA ID ou token não configurado" };
  }

  const templates: MetaTemplate[] = [];
  let pages = 0;
  let nextUrl: string | null = `https://graph.facebook.com/v21.0/${instancia.waba_id}/message_templates?limit=200`;

  while (nextUrl && pages < MAX_GRAPH_PAGES) {
    const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${instancia.access_token}` } });
    const payload = await response.json().catch(() => ({}));
    pages += 1;

    if (!response.ok) {
      const code = Number(payload?.error?.code || response.status);
      return {
        success: false,
        synced: 0,
        pages,
        error: String(payload?.error?.message || `HTTP ${response.status}`),
        code,
        retryable: response.status === 429 || response.status >= 500,
      };
    }

    templates.push(...((payload?.data || []) as MetaTemplate[]));
    nextUrl = typeof payload?.paging?.next === "string" ? payload.paging.next : null;
  }

  if (nextUrl) {
    return { success: false, synced: 0, pages, error: "Limite seguro de páginas da Meta atingido" };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("meta_whatsapp_templates")
    .select("nome_template,idioma,variaveis")
    .eq("instancia_id", instancia.id)
    .range(0, 3999);
  if (existingError) return { success: false, synced: 0, pages, error: existingError.message };

  const existingByKey = new Map<string, Record<string, any>>();
  for (const row of existingRows || []) {
    existingByKey.set(`${row.nome_template}|${row.idioma}`, (row.variaveis || {}) as Record<string, any>);
  }

  const syncedAt = new Date().toISOString();
  const rows = templates
    .filter((template) => template.name && template.language)
    .map((template) => {
      const components = template.components || [];
      const body = components.find((component) => component?.type === "BODY");
      const bodyText = typeof body?.text === "string" ? body.text : "";
      const previous = existingByKey.get(`${template.name}|${template.language}`) || {};
      return {
        instancia_id: instancia.id,
        nome_template: template.name,
        categoria: template.category || null,
        idioma: template.language,
        status: String(template.status || "pending").toLowerCase(),
        body_text: bodyText,
        variaveis: { ...extractVariables(bodyText), ...previous, ...extractTemplateMetadata(components) },
        sincronizado_em: syncedAt,
      };
    });

  for (const batch of chunks(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("meta_whatsapp_templates")
      .upsert(batch, { onConflict: "instancia_id,nome_template,idioma" });
    if (error) return { success: false, synced: 0, pages, error: error.message };
  }

  return { success: true, synced: rows.length, pages };
}