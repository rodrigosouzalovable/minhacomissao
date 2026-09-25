# Corrigir o DDI dos números internacionais no Envio Meta

## Diagnóstico confirmado
- A instância de teste cadastrada como **+1 555-976-4577** está registrada com o telefone internacional completo. No lote mais recente **Aquecer -6427** do Thiago, criado hoje às 14:46 UTC, o destinatário correspondente foi gravado como **5515559764577** e terminou em “Sem WhatsApp”; em lotes anteriores, o mesmo destino foi gravado corretamente como **15559764577**.
- O envio de templates já possui uma regra que preserva `1555…`, mas há outras etapas que ainda alteram o número: a tela transforma telefones de 11 dígitos sem `+` em brasileiros, e a verificação UAZAPI acrescenta `55` a qualquer número que não o tenha. A exportação dos números conectados entrega apenas dígitos, o que torna importante reconhecer esses testes também sem o sinal `+`.
- O erro anterior **#131026** significa que a Meta não confirmou a entrega. Corrigir o DDI não garante que números de teste `+1 555…` possam receber mensagens reais.

## Correção proposta
1. Preservar o DDI desde a exportação/importação até a fila e a chamada à Meta: **15559764577 deve permanecer 15559764577**; `+1 555-976-4577` deve produzir o mesmo destino. Aplicar a mesma regra aos demais números internacionais já identificados como tais, sem inferir um país para entradas ambíguas. Números brasileiros locais continuam recebendo `55`.
2. Eliminar a regra brasileira genérica na validação UAZAPI usada pela tela e durante a campanha. Para destinos internacionais, enviar o número correto à validação; se a verificação não conseguir confirmar o WhatsApp, registrar “não confirmado” e não classificar como “Sem WhatsApp” por uma consulta feita ao número com DDI errado. Não mudar o tratamento dos brasileiros.
3. Conferir os dados antes de iniciar um lote e mostrar o telefone final que será usado, com aviso para entradas ambíguas. Manter consistentes deduplicação, importação de planilha e exportação de testes.
4. Testar cenários de `15559764577`, `+15559764577`, telefones brasileiros com/sem `55` e entradas inválidas; verificar que o destino transmitido à Meta é exatamente o armazenado e que a validação não acrescenta outro DDI.
5. Não retomar automaticamente os lotes cancelados nem reenviar suas tentativas. Após a correção, fazer somente um teste autorizado e isolado, se houver um destino comprovadamente apto, e distinguir **aceito pela Meta** de **entregue**; se a Meta continuar recusando `+1 555…`, informar a necessidade de um número de teste real apto em vez de forçar a entrega.

## Detalhes técnicos e custo
Ajustar a normalização compartilhada do destinatário e os pontos que a contornam em `EnvioMeta`, `uazapi-validar-numeros` e exportação/importação dos testes; conferir `envio-meta-massa-iniciar` e `send-whatsapp-meta`. Sem novos agendamentos, consultas recorrentes ou canais; a alteração não deve aumentar significativamente o custo do Lovable Cloud. Um eventual envio de teste pode ter custo de template da Meta e não será feito como campanha automática.
