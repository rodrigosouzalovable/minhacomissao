import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MEDIA_BUCKET = "meta-template-media";

// Uploads a media file to Meta via Resumable Upload API and returns the header handle.
async function obterHeaderHandle(params: {
  appId: string;
  accessToken: string;
  fileBytes: Uint8Array;
  fileType: string;
  fileName: string;
}): Promise<string> {
  const { appId, accessToken, fileBytes, fileType, fileName } = params;

  // 1) start upload session
  const startUrl = new URL(`https://graph.facebook.com/v21.0/${appId}/uploads`);
  startUrl.searchParams.set("file_length", String(fileBytes.byteLength));
  startUrl.searchParams.set("file_type", fileType);
  startUrl.searchParams.set("file_name", fileName);
  startUrl.searchParams.set("access_token", accessToken);

  const startRes = await fetch(startUrl.toString(), { method: "POST" });
  const startData = await startRes.json();
  if (!startRes.ok || !startData?.id) {
    throw new Error(
      `resumable start falhou: ${startData?.error?.message || startRes.status}`,
    );
  }
  const sessionId: string = startData.id;

  // 2) upload binary
  const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: "0",
      "Content-Type": fileType,
    },
    body: fileBytes,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || !uploadData?.h) {
    throw new Error(
      `upload binário falhou: ${uploadData?.error?.message || uploadRes.status}`,
    );
  }
  return uploadData.h as string;
}

function buildComponents(mestre: any, headerHandle: string | null) {
  const components: any[] = [];

  if (mestre.cabecalho_tipo) {
    const header: any = { type: "HEADER", format: mestre.cabecalho_tipo };
    if (mestre.cabecalho_tipo === "TEXT" && mestre.cabecalho_texto) {
      header.text = mestre.cabecalho_texto;
      const headerVars = (mestre.exemplo?.header_text as string[]) || [];
      if (headerVars.length > 0) {
        header.example = { header_text: headerVars };
      }
    } else if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(mestre.cabecalho_tipo) &&
      headerHandle
    ) {
      header.example = { header_handle: [headerHandle] };
    }
    components.push(header);
  }

  const body: any = { type: "BODY", text: mestre.corpo };
  const bodyVars = (mestre.exemplo?.body_text as string[][]) || [];
  if (bodyVars.length > 0 && bodyVars[0]?.length > 0) {
    body.example = { body_text: bodyVars };
  }
  components.push(body);

  if (mestre.rodape) {
    components.push({ type: "FOOTER", text: mestre.rodape });
  }

  const botoes = Array.isArray(mestre.botoes) ? mestre.botoes : [];
  if (botoes.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: botoes.map((b: any) => {
        if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
        if (b.type === "URL") return { type: "URL", text: b.text, url: b.url, ...(b.example ? { example: [b.example] } : {}) };
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phone_number };
        return b;
      }),
    });
  }

  return components;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mestre_id, instancia_ids, apenas_falhas } = await req.json();
    if (!mestre_id) throw new Error("mestre_id obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    let usuario_id: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      usuario_id = userData?.user?.id ?? null;
    }

    const { data: mestre, error: me } = await supabase
      .from("meta_templates_mestre").select("*").eq("id", mestre_id).maybeSingle();
    if (me || !mestre) throw new Error("Template mestre não encontrado");

    let query = supabase.from("meta_whatsapp_instances")
      .select("id, nome, waba_id, phone_number_id, access_token, ativo, meta_bm_id");
    if (Array.isArray(instancia_ids) && instancia_ids.length > 0) {
      query = query.in("id", instancia_ids);
    } else {
      query = query.eq("ativo", true);
    }
    const { data: instancias, error: ie } = await query;
    if (ie || !instancias) throw new Error("Falha ao carregar instâncias");

    // Se o mestre usa cabeçalho de mídia, pré-carregamos o arquivo do Storage
    const precisaMidia =
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(mestre.cabecalho_tipo || "") &&
      !!mestre.cabecalho_media_url;

    let mediaBytes: Uint8Array | null = null;
    let mediaMime: string = mestre.cabecalho_media_mime || "application/octet-stream";
    let mediaName: string = "media";
    const bmAppIdCache = new Map<string, string>();
    let defaultAppId: string | null = null;

    if (precisaMidia) {
      // Carrega BM padrão + todas as BMs vinculadas às instâncias
      const { data: bms } = await supabase
        .from("meta_business_managers").select("id, app_id, padrao, ativo").eq("ativo", true);
      if (bms) {
        for (const b of bms) {
          bmAppIdCache.set(b.id, b.app_id);
          if (b.padrao) defaultAppId = b.app_id;
        }
      }
      // fallback legado: chave em meta_whatsapp_config
      if (!defaultAppId) {
        const { data: cfg } = await supabase
          .from("meta_whatsapp_config").select("valor").eq("chave", "meta_app_id").maybeSingle();
        defaultAppId = (cfg?.valor || "").trim() || null;
      }

      const path = String(mestre.cabecalho_media_url);
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from(MEDIA_BUCKET).download(path);
      if (dlErr || !fileBlob) {
        throw new Error(`Falha ao baixar mídia do cabeçalho: ${dlErr?.message || "arquivo não encontrado"}`);
      }
      mediaBytes = new Uint8Array(await fileBlob.arrayBuffer());
      mediaMime = fileBlob.type || mediaMime;
      const parts = path.split("/");
      mediaName = parts[parts.length - 1] || "media";
    }



    // pré-marca todas como ENVIADO para feedback imediato na UI
    const preRows = instancias.map((inst) => ({
      template_mestre_id: mestre_id,
      instancia_id: inst.id,
      waba_id: inst.waba_id,
      phone_number_id: inst.phone_number_id,
      status: "ENVIADO",
      erro: null,
    }));
    if (preRows.length > 0) {
      await supabase.from("meta_templates_instancia")
        .upsert(preRows, { onConflict: "template_mestre_id,instancia_id" });
    }

    // processa em background para evitar timeout de 150s
    const processar = async () => {
      const detalhes: any[] = [];
      let sucessos = 0;
      let falhas = 0;

      for (const inst of instancias) {
        if (apenas_falhas) {
          const { data: cur } = await supabase
            .from("meta_templates_instancia").select("status")
            .eq("template_mestre_id", mestre_id).eq("instancia_id", inst.id).maybeSingle();
          if (cur && !["FALHA_ENVIO", "REJECTED"].includes(cur.status)) continue;
        }

        if (!inst.waba_id || !inst.access_token) {
          falhas++;
          await supabase.from("meta_templates_instancia").upsert({
            template_mestre_id: mestre_id,
            instancia_id: inst.id,
            waba_id: inst.waba_id,
            phone_number_id: inst.phone_number_id,
            status: "FALHA_ENVIO",
            erro: "waba_id ou access_token ausente",
          }, { onConflict: "template_mestre_id,instancia_id" });
          detalhes.push({ instancia_id: inst.id, nome: inst.nome, ok: false, erro: "credenciais ausentes" });
          continue;
        }

        try {
          // Obter header_handle específico deste app/instância quando for mídia
          let headerHandle: string | null = null;
          if (precisaMidia && mediaBytes) {
            if (!metaAppId) {
              throw new Error(
                "Configure a chave 'meta_app_id' em meta_whatsapp_config antes de enviar templates com mídia",
              );
            }
            // reaproveita handle já obtido nesta instância (cache)
            const { data: prev } = await supabase
              .from("meta_templates_instancia").select("header_handle")
              .eq("template_mestre_id", mestre_id).eq("instancia_id", inst.id).maybeSingle();
            if (prev?.header_handle) {
              headerHandle = prev.header_handle;
            } else {
              headerHandle = await obterHeaderHandle({
                appId: metaAppId,
                accessToken: inst.access_token,
                fileBytes: mediaBytes,
                fileType: mediaMime,
                fileName: mediaName,
              });
              await supabase.from("meta_templates_instancia").upsert({
                template_mestre_id: mestre_id,
                instancia_id: inst.id,
                waba_id: inst.waba_id,
                phone_number_id: inst.phone_number_id,
                header_handle: headerHandle,
              }, { onConflict: "template_mestre_id,instancia_id" });
            }
          }

          const components = buildComponents(mestre, headerHandle);
          const payload = {
            name: mestre.nome,
            language: mestre.idioma || "pt_BR",
            category: mestre.categoria,
            components,
          };

          const res = await fetch(
            `https://graph.facebook.com/v21.0/${inst.waba_id}/message_templates`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${inst.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            },
          );
          const data = await res.json();

          if (!res.ok) {
            falhas++;
            const errMsg = data?.error?.error_user_msg || data?.error?.message || `HTTP ${res.status}`;
            await supabase.from("meta_templates_instancia").upsert({
              template_mestre_id: mestre_id,
              instancia_id: inst.id,
              waba_id: inst.waba_id,
              phone_number_id: inst.phone_number_id,
              status: "FALHA_ENVIO",
              erro: errMsg,
            }, { onConflict: "template_mestre_id,instancia_id" });
            detalhes.push({ instancia_id: inst.id, nome: inst.nome, ok: false, erro: errMsg });
          } else {
            sucessos++;
            const metaStatus = (data?.status || "PENDING").toUpperCase();
            await supabase.from("meta_templates_instancia").upsert({
              template_mestre_id: mestre_id,
              instancia_id: inst.id,
              waba_id: inst.waba_id,
              phone_number_id: inst.phone_number_id,
              meta_template_id: data?.id ? String(data.id) : null,
              status: metaStatus,
              erro: null,
              motivo_rejeicao: null,
            }, { onConflict: "template_mestre_id,instancia_id" });
            detalhes.push({ instancia_id: inst.id, nome: inst.nome, ok: true, meta_id: data?.id, status: metaStatus });
          }

        } catch (err) {
          falhas++;
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from("meta_templates_instancia").upsert({
            template_mestre_id: mestre_id,
            instancia_id: inst.id,
            waba_id: inst.waba_id,
            phone_number_id: inst.phone_number_id,
            status: "FALHA_ENVIO",
            erro: msg,
          }, { onConflict: "template_mestre_id,instancia_id" });
          detalhes.push({ instancia_id: inst.id, nome: inst.nome, ok: false, erro: msg });
        }

        await sleep(400);
      }

      await supabase.from("meta_templates_lote_log").insert({
        template_mestre_id: mestre_id,
        usuario_id,
        total_instancias: detalhes.length,
        sucessos,
        falhas,
        detalhes,
      });
    };

    // @ts-ignore EdgeRuntime existe no runtime do Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(processar());
    } else {
      processar();
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        total: instancias.length,
        message: "Processamento iniciado em background. Acompanhe pela aba Status.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 202 },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

