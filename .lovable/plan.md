# Corrigir os disparos do Thiago para números de teste Meta

## Diagnóstico verificado
- Nas campanhas **Aquecer -5599** e **Aquecer -6427** de hoje, cada instância YELLOW teve três mensagens aceitas inicialmente pela Meta; as seis voltaram como **Message undeliverable (#131026)**. Não há confirmação de entrega. Os 35 destinatários restantes de cada campanha ficaram pendentes e as instâncias saíram do rodízio.
- Os três destinos examinados estão cadastrados como testes Meta com telefones **+1 555…**. Porém, o envio transformou `1555…` em **`551555…`**: a função que envia templates acrescenta o DDI 55 a todo telefone que não começa em 55. Esse número diferente consta nos registros das seis falhas. O erro não demonstra, por si só, que a qualidade YELLOW impediu os disparos.
- O mecanismo de retorno de falhas também retirou a instância após três recusas de entrega do destinatário, com motivo “Message undeliverable”, e exibiu “Aguardando liberação”. Isso mistura falha de destino com bloqueio da instância.

## Correção proposta
1. **Preservar o DDI de destinos internacionais.** Corrigir a normalização na importação, no início do lote e no envio Meta para manter `+1 555…` como `1555…`, sem acrescentar 55. Telefones brasileiros locais continuam recebendo 55; entradas internacionais sem DDI inequívoco serão sinalizadas, não adivinhadas. Conferir também registros de conversa e deduplicação para não criar um contato com o DDI errado.
2. **Distinguir aceitação de entrega.** Quando a Meta aceitar um template, mostrar “aceito/aguardando entrega”; quando chegar `#131026`, marcar aquele destinatário como falha definitiva, registrar o motivo real e não contar como mensagem entregue. Não reenviar automaticamente o mesmo destino por outra instância quando a Meta disser que ele é inalcançável.
3. **Não punir o remetente por destino inalcançável.** No retorno de entrega, impedir que `#131026` e equivalentes bloqueiem a instância ou congelem toda a campanha; preservar a retirada para bloqueios reais da Meta e falhas atribuíveis ao remetente. Manter a liberação já existente para as instâncias vinculadas ao Thiago, sem estendê-la a outros usuários nem alterar o pool manualmente.
4. **Validar se esses testes podem receber mensagens.** Depois da correção de DDI, conferir com um único destino de teste autorizado, por uma instância do Thiago, tanto a aceitação quanto a entrega e eventual resposta na caixa AQUECIMENTO. Se a Meta continuar devolvendo `#131026` para os números `+1 555…`, tratá-los como destinos não entregáveis, excluí-los dos próximos lotes e informar que precisam ser substituídos por números reais aptos; não forçar envio nem mascarar a recusa da Meta.
5. **Resolver o estado dos dois lotes atuais com segurança.** Não repetir automaticamente as seis tentativas recusadas nem disparar os 35 pendentes de cada lote. Após validar um destino, indicar claramente o que ainda pode ser enviado e exigir uma nova ação do Thiago para retomar ou recriar esses lotes, sem afetar outras campanhas.

## Detalhes técnicos e custo
- Pontos principais: `send-whatsapp-meta`, normalização de destinatários no `EnvioMeta`, `envio-meta-massa-iniciar`/`tick`, retorno de status em `meta-whatsapp-webhook` e apresentação de resultados da campanha.
- Testes com números BR e internacionais; callbacks `sent`, `delivered` e `failed #131026`; YELLOW/RED autorizado, bloqueio real da Meta e campanhas de outros usuários.
- Sem cron, polling ou carga recorrente adicional. O teste pontual poderá gerar cobrança de template pela Meta; nenhum lote será disparado automaticamente.
