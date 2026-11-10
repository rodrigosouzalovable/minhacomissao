import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'inbox-media';
// Bucket é privado: URLs assinadas de longa duração permitem que a Meta/UAZAPI
// baixem a mídia no envio e que o histórico continue exibindo os arquivos.
const DEFAULT_EXPIRES = 60 * 60 * 24 * 365; // 1 ano

/** Gera uma URL assinada para um arquivo do bucket privado inbox-media. */
export async function signedInboxMediaUrl(
  path: string,
  expiresIn = DEFAULT_EXPIRES,
): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error('Não foi possível liberar o acesso ao arquivo anexado. Atualize a conversa e tente novamente. Se persistir, confira seu acesso à caixa de mensagens.');
  return data.signedUrl;
}

/** Faz upload no inbox-media e devolve a URL assinada do arquivo. */
export async function uploadInboxMedia(
  path: string,
  file: Blob,
  contentType?: string,
  opts?: { upsert?: boolean; expiresIn?: number },
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: opts?.upsert ?? false });
  if (error) throw new Error('Não foi possível salvar o arquivo anexado. Atualize a conversa e tente novamente. Se persistir, confira seu acesso à caixa de mensagens.');
  return signedInboxMediaUrl(path, opts?.expiresIn);
}

/** Extrai o caminho interno a partir de uma URL pública ou assinada do bucket. */
export function inboxMediaPathFromUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/inbox-media\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Reassina URLs antigas (públicas) ou expiradas para que continuem abrindo
 * agora que o bucket é privado. Retorna a URL original se não for do bucket.
 */
// Display links are re-issued with the viewer's own session (storage rules apply), so a
// stored link stops working for someone who lost access. Short-lived, cached per session.
const VIEW_EXPIRES = 60 * 60; // 1 hora
const viewCache = new Map<string, { url: string; ate: number }>();

export async function ensureInboxMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const path = inboxMediaPathFromUrl(url);
  if (!path) return url;
  const cached = viewCache.get(path);
  if (cached && cached.ate > Date.now()) return cached.url;
  try {
    const signed = await signedInboxMediaUrl(path, VIEW_EXPIRES);
    viewCache.set(path, { url: signed, ate: Date.now() + (VIEW_EXPIRES - 300) * 1000 });
    return signed;
  } catch {
    return null;
  }
}
