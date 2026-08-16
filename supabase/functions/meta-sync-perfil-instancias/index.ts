// Sincroniza o nome oficial (verified_name) e a foto de perfil do WhatsApp Business
// de cada instância Meta. A URL de foto que a Meta devolve é temporária, então a
// imagem é copiada para o bucket privado "meta-perfis" e gravamos uma URL assinada
// de longa duração na instância.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { idsInstanciasPermitidas, filtrarInstancias } from '../_shared/escopo-instancias.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v21.0';
const BUCKET = 'meta-perfis';
const SIGNED_TTL = 60 * 60 * 24 * 365; // 1 ano

async function fetchJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const instanciaId: string | undefined = body?.instancia_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let query = supabase
      .from('meta_whatsapp_instances')
      .select('id, nome, phone_number_id, access_token, display_phone')
      .eq('ativo', true);
    if (instanciaId) query = query.eq('id', instanciaId);
    const { data: instanciasRaw, error } = await query;
    if (error) throw error;

    const permitidas = await idsInstanciasPermitidas(req, supabase);
    const instancias = filtrarInstancias(instanciasRaw as any[], permitidas);

    const results: any[] = [];

    for (const inst of instancias || []) {
      const r: any = { instancia_id: inst.id, nome: inst.nome };
      try {
        const patch: any = { meta_perfil_sync_em: new Date().toISOString() };

        // 1) Nome oficial / status do nome
        const phoneResp = await fetchJson(
          `${GRAPH}/${inst.phone_number_id}?fields=verified_name,name_status,display_phone_number`,
          inst.access_token,
        );
        if (phoneResp.ok) {
          patch.meta_verified_name = phoneResp.data?.verified_name || null;
          patch.meta_name_status = phoneResp.data?.name_status || null;
          r.verified_name = patch.meta_verified_name;
          r.name_status = patch.meta_name_status;
        } else {
          r.error = phoneResp.data?.error?.message || `HTTP ${phoneResp.status}`;
        }

        // 2) Perfil do WhatsApp Business (foto + sobre)
        const profResp = await fetchJson(
          `${GRAPH}/${inst.phone_number_id}/whatsapp_business_profile?fields=profile_picture_url,about`,
          inst.access_token,
        );
        if (profResp.ok) {
          const prof = profResp.data?.data?.[0] || {};
          patch.meta_profile_about = prof?.about || null;
          r.about = patch.meta_profile_about;

          const picUrl: string | undefined = prof?.profile_picture_url;
          if (picUrl) {
            try {
              const imgRes = await fetch(picUrl);
              if (imgRes.ok) {
                const bytes = new Uint8Array(await imgRes.arrayBuffer());
                const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                const path = `${inst.phone_number_id}.jpg`;
                const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
                  contentType,
                  upsert: true,
                });
                if (up.error) {
                  r.foto_error = up.error.message;
                } else {
                  const signed = await supabase.storage
                    .from(BUCKET)
                    .createSignedUrl(path, SIGNED_TTL);
                  if (signed.data?.signedUrl) {
                    patch.meta_profile_pic_url = signed.data.signedUrl;
                    r.foto = true;
                  } else if (signed.error) {
                    r.foto_error = signed.error.message;
                  }
                }
              } else {
                r.foto_error = `download HTTP ${imgRes.status}`;
              }
            } catch (e) {
              r.foto_error = e instanceof Error ? e.message : 'erro ao baixar foto';
            }
          } else {
            patch.meta_profile_pic_url = null;
            r.foto = false;
          }
        } else {
          r.perfil_error = profResp.data?.error?.message || `HTTP ${profResp.status}`;
        }

        await supabase.from('meta_whatsapp_instances').update(patch).eq('id', inst.id);
      } catch (e) {
        r.error = e instanceof Error ? e.message : 'erro';
      }
      results.push(r);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.log('[meta-sync-perfil-instancias] exception', err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
