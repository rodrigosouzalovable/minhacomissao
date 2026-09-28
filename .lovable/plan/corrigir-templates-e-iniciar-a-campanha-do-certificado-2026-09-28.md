# Corrigir templates e iniciar a campanha do Certificado

## Resultado esperado
- Na instância **SOUZA 62 8243-4364**, “Aplicar templates” deve mostrar o progresso real, enviar os modelos válidos à Meta e informar claramente os que forem recusados ou ainda aguardarem aprovação. O modelo **cnpj_atualizado_2** precisa estar aprovado nessa instância antes de ela participar de disparos.
- Uma campanha de **Certificado Digital · Casa dos Dados** deve aparecer como as demais em **Campanhas**, com destinatários e progresso reais — sem voltar a usar leads do Google Maps.

## O que foi confirmado
- A instância mostra zero modelos reais sincronizados; sua fila contém **33 pendentes e 3 falhas de envio**, estas com mensagem genérica de erro. O botão atualmente confirma apenas a entrada na fila, não a criação/aprovação na Meta.
- A campanha de renovação anual de hoje foi **concluída com um envio** e aparece entre as finalizadas. Isso não é uma campanha ativa de aquecimento com volume. O fluxo automático desta semana busca apenas empresas abertas exatamente um ano antes; não está usando D+5 a D+30.
- O envio do Certificado exige instância conectada, qualidade permitida e **cnpj_atualizado_2 aprovado**. A instância da imagem não satisfaz atualmente o último requisito.

## Passos
1. Rastrear a resposta completa da criação dos três modelos que falharam, verificar autorização/permissões da instância e diagnosticar por que a fila continua sem modelos reais. Corrigir o erro na origem, registrar o motivo específico por modelo e impedir que o botão comunique sucesso antes de haver resultado verificável; preservar limites graduais, horários, pausas e tratamento de rejeições da Meta.
2. Reconciliar a fila da instância com a lista real da Meta, priorizar **cnpj_atualizado_2** se válido e acompanhar sua submissão/aprovação. Se houver bloqueio por permissão, conta ou recusa da Meta, mostrar o motivo e não fingir que foi aplicado.
3. Além da renovação anual já concluída, criar uma **execução pontual autorizada** com novos leads da Casa dos Dados nas janelas **D+5 a D+30** e nos CNAEs já definidos, sem mudar silenciosamente a rotina diária do piloto anual. Verificar WhatsApp, deduplicar contatos, reservar por instância apta e iniciar o job comum somente após incluir os destinatários. Instâncias sem template aprovado ficam de fora até a aprovação.
4. Conferir em Campanhas o item novo com contagem e status corretos; conferir na Meta os modelos efetivamente criados e testar erros/limites sem duplicar mensagens ou reativar campanhas canceladas.

## Limites e custos
**⚠️ ALERTA DE CUSTO ALTO LOVABLE CLOUD:** A coleta adicional na Casa dos Dados, a verificação de WhatsApp e os envios reais podem elevar custos; até 50 contatos por instância apta significam até cerca de **R$10 por instância** em mensagens MARKETING a R$0,20, ou **R$2 por instância** em UTILITY a R$0,04, além dos custos de consulta/verificação. Respeitar o teto existente de **R$120/dia** para aquecimento e a quota individual de cada instância; não criar cron, polling ou canal em tempo real. A aprovação deste plano autoriza esta execução pontual; se o custo estimado ultrapassar o teto, reduzir o lote antes de enviar.

## Detalhes técnicos
Investigar `meta-templates-onboarding-tick`, `meta-criar-template-lote` e o retorno de “Aplicar templates”; corrigir a visibilidade dos erros e sincronizar `meta_whatsapp_templates`. Para a campanha, usar a preparação do Certificado e os jobs já existentes (`envio_meta_job` / `envio_meta_job_item`), com filtro de templates aprovados, salvaguardas de qualidade e deduplicação por sufixo telefônico. Verificar a execução real e o armazenamento dos vínculos antes de declarar concluído.
