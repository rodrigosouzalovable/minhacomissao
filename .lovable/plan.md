# Mensagem certa para os leads do Google Maps

## O que está errado hoje

1. Na caixa AQUECIMENTO aparece o texto `[Aquecimento] template novo_seguranca_do_processo` — isso é só uma etiqueta interna, não a mensagem real que o lead recebeu. O histórico não mostra o texto verdadeiro.
2. O sistema escolhe qualquer modelo aprovado do número (hoje pegou um modelo de cobrança), então clínicas e empresas do Google Maps recebem uma mensagem de cobrança que não faz sentido para elas.

## O que será feito

1. **Mostrar a mensagem real:** o histórico da caixa AQUECIMENTO passa a gravar o texto do modelo já com o nome da empresa preenchido, em vez da etiqueta interna. O nome do modelo continua visível como informação secundária.
2. **Separar os modelos de lead:** na aba Template Meta, cada modelo mestre ganha a marcação "Usar no aquecimento de leads". Só modelos marcados são usados nos envios para leads do Google Maps.
3. **Escolha inteligente:** entre os modelos marcados, o sistema sorteia (rodízio) para não repetir sempre o mesmo, e prefere os que só precisam do nome da empresa.
4. **Proteção:** se nenhum modelo de lead estiver marcado/aprovado naquele número, o envio para lead é pulado (nada de cair em modelo de cobrança). Envios entre os próprios números (UAZAPI) continuam como estão.
5. Os envios já registrados com o texto antigo permanecem; a correção vale para os próximos.

## Ideias de modelos para subir (categoria MARKETING, pt_BR)

Leads frios exigem categoria MARKETING na Meta, com opção de sair da lista. Sugestões curtas e neutras:

1. `lead_apresentacao_parceria`
   "Olá, {{1}}! Sou da equipe de tecnologia da Clara. Ajudamos empresas como a sua a organizar atendimento e cobrança pelo WhatsApp. Posso te enviar um resumo rápido? Se não quiser receber, responda SAIR."
2. `lead_site_gratis`
   "Oi, {{1}}! Vi seu negócio no Google e notei que ele pode aparecer melhor na internet. Preparo um esboço de site sem custo para você avaliar. Quer ver? Responda SAIR para não receber mais."
3. `lead_atendimento_whatsapp`
   "Olá, {{1}}! Muitos clientes desistem quando ninguém responde no WhatsApp. Temos um atendente automático que responde na hora. Quer saber como funciona? Responda SAIR para sair da lista."
4. `lead_google_avaliacoes`
   "Oi, {{1}}! Avaliações no Google trazem mais clientes. Ajudamos a pedir avaliações automaticamente após cada atendimento. Te explico em 2 minutos? Responda SAIR para não receber mais."
5. `lead_agenda_lembretes`
   "Olá, {{1}}! Reduza faltas na agenda com lembretes automáticos no WhatsApp. Quer testar sem compromisso? Responda SAIR para sair da lista."

Todos usam apenas `{{1}}` (nome da empresa), sem imagem e sem botão com link variável — o formato mais seguro e o que o sistema já preenche sozinho.

## Detalhes técnicos

- `_shared/meta-aquecimento-inteligente.ts` → `registrarConversaLead` passa a receber o corpo renderizado do template e grava em `meta_whatsapp_mensagens.conteudo`.
- `_shared/meta-aquecimento-alvo.ts` → `escolherTemplateAprovado` retorna também o `body` do template; nova função `escolherTemplateLead` filtra pelos nomes marcados, sorteia entre eles e prefere menos variáveis; helper para renderizar `{{n}}` com o nome do lead.
- Nova coluna booleana `usar_em_leads` em `meta_templates_mestre`, com toggle em `src/pages/MetaTemplates.tsx`.
- `meta-aquecimento-tick` usa `escolherTemplateLead` quando `fonte = 'lead'` e pula o envio (`sem_template_lead`) quando não houver modelo elegível.
- Sem novo cron, sem novo polling — nenhum impacto de custo.
