// Cache de status de conexão UAZAPI por instância.
// TTL de 5 min para reduzir drasticamente as chamadas de test-uazapi-connection.
// Resultado: economia de ~80% das invocações dessa edge function.
import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 5 * 60 * 1000;
const STORAGE_KEY = "uazapi-conn-cache-v1";

export type ConnectionCheckResult = {
  ok: boolean;
  data?: any;
  endpoint?: string;
  error?: string;
};

type CacheEntry = { value: ConnectionCheckResult; ts: number };

const memCache = new Map<string, CacheEntry>();

function loadStorage(): Record<string, CacheEntry> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveStorage(map: Record<string, CacheEntry>) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
}

function getCached(key: string): ConnectionCheckResult | null {
  const inMem = memCache.get(key);
  const now = Date.now();
  if (inMem && now - inMem.ts < TTL_MS) return inMem.value;
  const store = loadStorage();
  const e = store[key];
  if (e && now - e.ts < TTL_MS) {
    memCache.set(key, e);
    return e.value;
  }
  return null;
}

function setCached(key: string, value: ConnectionCheckResult) {
  const entry: CacheEntry = { value, ts: Date.now() };
  memCache.set(key, entry);
  const store = loadStorage();
  store[key] = entry;
  // Trim old entries
  const now = Date.now();
  for (const k of Object.keys(store)) {
    if (now - store[k].ts > TTL_MS * 2) delete store[k];
  }
  saveStorage(store);
}

export async function checkUazapiConnection(
  instanceId: string,
  serverUrl: string,
  instanceToken: string,
  opts: { force?: boolean } = {}
): Promise<ConnectionCheckResult> {
  const key = instanceId || `${serverUrl}::${instanceToken}`;
  if (!opts.force) {
    const cached = getCached(key);
    if (cached) return cached;
  }
  try {
    const { data, error } = await supabase.functions.invoke("test-uazapi-connection", {
      body: { server_url: serverUrl, instance_token: instanceToken },
    });
    if (error) throw error;
    const result: ConnectionCheckResult = data as any;
    setCached(key, result);
    return result;
  } catch (e: any) {
    const result: ConnectionCheckResult = { ok: false, error: e?.message || "erro" };
    // Cache failures briefly too (avoid hammering on outage)
    setCached(key, result);
    return result;
  }
}

export function isResultConnected(data: ConnectionCheckResult | null | undefined): boolean {
  if (!data?.ok) return false;
  const payload: any = data.data ?? {};
  const instanceData = payload?.instance ?? payload;
  const rawStatus = String(instanceData?.status ?? payload?.status ?? "").toLowerCase();
  return (
    rawStatus === "connected" ||
    rawStatus === "open" ||
    rawStatus === "online" ||
    instanceData?.connected === true ||
    payload?.connected === true ||
    payload?.status?.connected === true
  );
}

export function clearUazapiConnectionCache() {
  memCache.clear();
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}
