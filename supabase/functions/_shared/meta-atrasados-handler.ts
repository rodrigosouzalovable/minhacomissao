import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { brtDate, greenSender, reminderValues, reminderWindow } from './meta-atrasados-rules.ts';
import { handleSendWhatsAppMeta } from './send-whatsapp-meta-handler.ts';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:{...corsHeaders,'Content-Type':'application/json'}});
const must = (result: any) => { if(result.error) throw new Error(result.error.message); return result.data; };
export async function handleMetaAtrasados(req: Request): Promise<Response> {
  if(req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  const url=Deno.env.get('SUPABASE_URL'); const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key) return reply({error:'Serviço de lembretes não configurado'},500);
  const db=createClient(url,key); const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  let internal=token===key; let uid: string | undefined;
  try {
    const input=await req.json().catch(()=>({}));
    if(!internal){const auth=await db.auth.getUser(token); uid=auth.data.user?.id; if(auth.error||!uid) return reply({error:'Sessão inválida'},401); const admin=must(await db.rpc('has_role',{_user_id:uid,_role:'admin'})); if(!admin) return reply({error:'Acesso restrito ao administrador'},403);}
    const preview=!internal;
    if(preview && input.action!=='preview') return reply({error:'Somente prévia é permitida por esta tela'},400);
    const today=brtDate();
    if(internal && !reminderWindow()) return reply({ok:true,skipped:'Domingo ou fora do horário de envio'});
    let configs: any[];
    if(preview){
      if(typeof input.tenant_id!=='string'||typeof input.template_nome!=='string'||typeof input.idioma!=='string') return reply({error:'Configuração inválida'},400);
      if(!must(await db.rpc('user_can_access_tenant',{_uid:uid,_tenant:input.tenant_id}))) return reply({error:'Sem acesso à empresa'},403);
      const master=must(await db.from('meta_templates_mestre').select('id').eq('criado_por',uid).eq('tenant_id',input.tenant_id).eq('nome',input.template_nome).eq('idioma',input.idioma).eq('categoria','UTILITY').maybeSingle());
      if(!master) return reply({error:'Selecione um template Utility próprio'},400);
      configs=[{owner_id:uid,tenant_id:input.tenant_id,template_nome:input.template_nome,idioma:input.idioma,variaveis_map:input.variaveis_map||{'1':'nome','2':'credor','3':'vencimento'}}];
    } else {
      configs=must(await db.from('meta_atrasados_config').select('*').eq('ativo',true).order('atualizado_em').limit(10))||[];
    }
    const summaries: any[]=[]; const start=Date.now();
    for(const cfg of configs){
      if(Date.now()-start>65000) break;
      const lease=crypto.randomUUID();
      if(!preview && !must(await db.rpc('meta_atrasados_lock',{p_config:cfg.id,p_token:lease}))) continue;
      let processed=0,accepted=0; const rows: any[]=[];
      try {
        const candidates=must(await db.rpc('meta_atrasados_candidatos',{p_owner:cfg.owner_id,p_tenant:cfg.tenant_id,p_dia:today,p_template:cfg.template_nome,p_idioma:cfg.idioma,p_limite:preview?50:20}))||[];
        for(const candidate of candidates){
          if(!preview && Date.now()-start>65000) break;
          const sender=candidate.sender; let reason: string|null=null;
          const phone=String(candidate.cliente_telefone||'').replace(/\D/g,''); const tel=phone.startsWith('55')?phone:`55${phone}`;
          if(phone.length<10||phone.length>15) reason='Telefone do cliente ausente ou inválido';
          if(!sender) reason=reason||'Aguardando instância GREEN com template aprovado e caixa/etiqueta compatível com o funcionário';
          const vars=reminderValues(candidate.cliente_nome,candidate.empresa,candidate.data_prevista,cfg.variaveis_map,sender?.body_text||'{{1}} {{2}} {{3}}');
          if(!vars) reason=reason||'Nome, credor, vencimento ou mapeamento de variáveis incompleto';
          const suppression=must(await db.from('meta_destinatario_supressao').select('telefone_sufixo').eq('telefone_sufixo',tel.slice(-8)).maybeSingle());
          if(suppression) reason='Telefone bloqueado na blacklist/supressão';
          if(sender){
            const inst=must(await db.from('meta_whatsapp_instances').select('id,ativo,provider,saude_status,saude_quality,qualidade_leitura_ok,saude_checked_at,estado_pool,pool_fora_manual,instancia_teste_aquecimento,pausa_automatica_ate,quarentena_ate,rate_limit_ate,saude_restricoes').eq('id',sender.id).maybeSingle());
            if(!inst||!greenSender(inst)) reason=reason||'GREEN recente e disponibilidade não confirmados';
            const components=sender.variaveis?._components||[];
            if(components.some((c:any)=>c.type==='HEADER')||components.some((c:any)=>c.type==='BUTTONS'&&c.buttons?.some((b:any)=>b.type==='URL'&&String(b.url).includes('{{')))) reason=reason||'Template exige cabeçalho ou link adicional; selecione um modelo apenas com as variáveis mapeadas';
            if(sender.meta_bm_id){const quotas=must(await db.rpc('meta_bm_uso_24h'));const quota=quotas?.find((q:any)=>q.bm_id===sender.meta_bm_id);if(!quota||(!quota.tier_ilimitado&&Number(quota.restantes)<=0))reason=reason||'Cota da BM indisponível ou esgotada';}
          }
          const legacyQueue=must(await db.from('whatsapp_fila').select('id').eq('pagamento_id',candidate.pagamento_id).like('tipo_lembrete','vencido%').eq('status','pendente').limit(1));
          const legacyLog=must(await db.from('whatsapp_lembretes_log').select('id').eq('pagamento_id',candidate.pagamento_id).like('tipo_lembrete','vencido%').eq('sucesso',true).gte('enviado_em',today+'T03:00:00Z').limit(1));
          if(legacyQueue?.length||legacyLog?.length) reason=reason||'Lembrete já enviado hoje ou pendente na outra automação';
          const message=String(sender?.body_text||'').replace(/\{\{\s*([\w]+)\s*\}\}/g,(_m,k)=>vars?.[k]||`{{${k}}}`);
          rows.push({...candidate,sender:sender?{id:sender.id,nome:sender.nome}:null,mensagem:message,motivo:reason});
          if(preview) continue;
          const reservation=must(await db.rpc('meta_atrasados_reservar',{p_config:cfg.id,p_pagamento:candidate.pagamento_id,p_etapa:candidate.etapa,p_vencimento:candidate.data_prevista,p_dia:today}));
          if(!reservation)continue;
          processed++;
          const update=async(status:string,motivo:string|null,waId:string|null=null)=>must(await db.from('meta_atrasados_envios').update({status,motivo,wa_message_id:waId,instancia_id:sender?.id,instancia_nome:sender?.nome,atendente_nome:candidate.atendente_nome,credor:candidate.empresa,mensagem:message,atualizado_em:new Date().toISOString()}).eq('id',reservation));
          if(reason){await update('pendente',reason);continue;}
          try {
            // The contact RPC validates exact user/label membership atomically, without granting access.
            must(await db.rpc('meta_atrasados_contato',{p_instancia:sender.id,p_telefone:tel,p_user:candidate.user_id,p_nome:candidate.cliente_nome,p_credor:({ume_novo_mundo:'novo_mundo',mundo_da_moda:'ume',odres_cred:'odres_cred'} as any)[candidate.empresa]}));
            const fresh=must(await db.from('pagamentos').select('status,data_prevista,acordos!inner(status)').eq('id',candidate.pagamento_id).maybeSingle());
            const active=must(await db.from('meta_atrasados_config').select('ativo').eq('id',cfg.id).maybeSingle());
            if(!active?.ativo||fresh?.status!=='pendente'||fresh.data_prevista!==candidate.data_prevista||fresh.acordos?.status!=='ativo'){await update('cancelado','Parcela paga, vencimento alterado, acordo encerrado ou automação pausada');continue;}
            const response=await handleSendWhatsAppMeta(new Request('http://internal/send',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({instancia_id:sender.id,template_id:sender.template_id,user_id:cfg.owner_id,folder_id:sender.folder_id,cliente:{telefone:tel,nome:candidate.cliente_nome,cpf:candidate.cliente_cpf,vars},credor:({ume_novo_mundo:'novo_mundo',mundo_da_moda:'ume',odres_cred:'odres_cred'} as any)[candidate.empresa]})}));
            const result=await response.json();
            if(result.success===true&&result.waId){await update('aceito',null,result.waId);accepted++;}
            else {await update('incerto',result.error||'Aceitação não confirmada; conferir antes de reenviar');}
          }catch(error){await update('incerto',error instanceof Error?error.message:'Falha sem confirmação de aceitação');}
          if(Date.now()-start<65000) await new Promise(resolve=>setTimeout(resolve,(Math.max(1,cfg.min_seg)+Math.random()*Math.max(1,cfg.max_seg-cfg.min_seg))*1000));
        }
        const priceRows=must(await db.from('meta_tarifas_mensagem').select('valor_brl,valor_usd').eq('categoria','UTILITY').lte('vigencia_inicio',today).order('vigencia_inicio',{ascending:false}).limit(1));
        const eligible=rows.filter(r=>!r.motivo).length;
        summaries.push({rows,processados:processed,aceitos:accepted,amostra:rows.length,limite_amostra:preview?50:20,elegiveis:eligible,estimativa_brl:priceRows?.[0]?eligible*Number(priceRows[0].valor_brl):null,estimativa_usd:priceRows?.[0]?eligible*Number(priceRows[0].valor_usd):null});
      }finally{if(!preview)must(await db.from('meta_atrasados_config').update({lease_token:null,lease_ate:null}).eq('id',cfg.id).eq('lease_token',lease));}
    }
    return reply({ok:true,preview,resumos:summaries});
  }catch(error){return reply({error:error instanceof Error?error.message:'Falha ao consultar lembretes'},500);}
}