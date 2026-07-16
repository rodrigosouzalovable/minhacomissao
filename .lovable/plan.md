Diagnóstico encontrado até agora

1. O número “6.578 envios” da tela não é a mesma coisa que “conversas cobradas pela Meta”.
   - Essa métrica vem de mensagens de saída no inbox (`meta_whatsapp_mensagens`).
   - Cobrança da Meta vem por conversa/categoria no billing oficial, não por linha de mensagem do inbox.

2. Pelo snapshot oficial de billing já sincronizado no sistema, o custo real identificado é muito menor que US$144,95:
   - Conversas totais no snapshot: 4.951
   - Utility REGULAR cobrada: 3.684 conversas
   - Utility grátis / customer service: 13
   - Service grátis: 1.254
   - Custo real calculado no snapshot: US$25,05
   - Preço unitário encontrado no snapshot: US$0,0068 por utility regular

3. As faturas importadas somam US$144,95 porque existem cobranças de US$25,00 importadas em 15/07 que não batem com o consumo real por instância:
   - LD 13: faturas US$27,49, mas snapshot da instância US$2,78
   - LD 17: faturas US$25,53, mas snapshot US$0,54
   - MEMU 16: faturas US$25,41, mas snapshot US$0,41
   - MEMU 15: fatura US$25,00, mas snapshot US$0,00
   - LD 18: fatura US$25,00, mas não tem envios/snapshot registrados

4. Isso indica que o problema provavelmente não é “mensagem marketing escondida” no sistema. O snapshot oficial mostra Utility, não Marketing.
   A divergência forte está entre “atividade de pagamento/fatura importada” e “consumo de conversas”. A hipótese principal é que esses PDFs de pagamento estão registrando cobranças/limiares/atividade do cartão no nível da conta de pagamento/Business, e não o consumo exato daquela instância individual.

5. Também encontrei lacunas técnicas que precisam ser corrigidas para a conciliação ficar confiável:
   - Há WABAs no snapshot sem correspondência com instância atual cadastrada: US$1,7136 em um WABA órfão.
   - MEMU 15 e MEMU 16 possuem envios sem `pricing_category` em parte dos registros, todos do template `agende_a_videoconferncia`.
   - O card de faturas importadas mostra pagamentos manuais, mas ainda não diferencia “cobrança do cartão” de “custo real de conversa”.

Alerta de custo Lovable Cloud

A solução abaixo adiciona consultas de conciliação e pode executar sincronizações sob demanda com a Meta. Para manter custo baixo, vou implementar sem polling agressivo, sem realtime novo, com `staleTime` alto, paginação/limites e botão manual de sincronização. Não criarei cron novo nem intervalos frequentes.

Plano de correção definitiva

1. Criar uma tela/área de “Conciliação Meta” dentro da API Oficial Meta
   - Mostrar 3 totais separados:
     - Faturas importadas do cartão: US$144,95
     - Custo oficial por conversas Meta: US$25,05
     - Diferença pendente de explicação: US$119,90
   - Deixar claro que “fatura importada” não deve ser tratada automaticamente como consumo da instância.

2. Adicionar tabela por instância com comparação lado a lado
   - Instância
   - Telefone
   - WABA
   - Envios registrados
   - Conversas oficiais cobradas
   - Custo oficial Meta
   - Faturas importadas
   - Diferença
   - Status: “OK”, “fatura maior que consumo”, “sem snapshot”, “WABA órfão”, “sem pricing_category”

3. Corrigir a métrica que está confundindo a análise
   - Renomear/ajustar o card “Todos os envios” para não parecer custo de billing.
   - Adicionar o número correto para cobrança: “Conversas cobradas Meta”.
   - Usar `meta_billing_snapshot` como fonte para custo, não `meta_whatsapp_mensagens`.

4. Melhorar a importação do PDF
   - Ao importar, identificar se o PDF representa:
     - pagamento/cobrança do cartão,
     - atividade de conta de pagamento,
     - ou consumo por WABA/telefone.
   - Se o PDF não trouxer WABA/telefone/conta vinculável com segurança, salvar como “pagamento não conciliado” em vez de atribuir automaticamente a uma instância.
   - Exibir alerta quando o valor importado for US$25,00 e o consumo da instância for muito menor, para evitar falsa associação.

5. Criar lista de “alertas de suspeita”
   - Instância com fatura US$25 mas custo oficial menor que US$1.
   - Instância com fatura e zero envio/snapshot.
   - WABA com custo oficial mas sem instância cadastrada.
   - Template com envios sem categoria de pricing.
   - Diferença total entre faturas e billing oficial acima de limite configurável.

6. Corrigir/backfill dos registros sem categoria
   - Para envios sem `pricing_category`, preencher a categoria a partir do template quando seguro.
   - Principal caso encontrado: `agende_a_videoconferncia` em MEMU 15/MEMU 16.
   - Isso melhora relatórios internos, mas o custo final continuará vindo do billing oficial da Meta.

7. Adicionar botão manual econômico “Sincronizar billing oficial”
   - Reusar a função existente `meta-billing-sync`.
   - Não criar cron novo.
   - Mostrar última sincronização e erros retornados pela Meta.
   - Sincronizar últimos 35 dias sob demanda.

8. Entregar uma conclusão operacional na própria tela
   - “Até agora, o sistema não encontrou marketing cobrado.”
   - “O consumo oficial identificado é aproximadamente US$25,05.”
   - “A diferença de US$119,90 vem das faturas importadas e precisa ser conciliada com a conta de pagamento/cartão, pois várias cobranças de US$25 não batem com o consumo das instâncias atribuídas.”

Resultado esperado

Depois da implementação, você terá uma tela objetiva para provar:
- quanto a Meta realmente cobrou por conversas,
- quais instâncias realmente geraram custo,
- quais PDFs/cobranças de cartão não batem com uso,
- se existe WABA/conta órfã consumindo,
- e quais importações precisam ser reclassificadas antes de concluir que houve uso indevido do cartão.