# Aumentar a captação do Google Maps e adicionar conta reserva

## Situação confirmada

- O abastecimento automático está limitado a **60 requisições Places por dia**, em lotes de até 12 por execução.
- Cada busca salva no máximo 60 empresas, mas uma requisição não equivale necessariamente a um lead novo: duplicidades e empresas sem telefone reduzem o resultado.
- Hoje foram consumidas **20 requisições automáticas**, trazendo **127 empresas automáticas**. No total do dia, a base recebeu 187 empresas e há 97 contatos com WhatsApp prontos para aquecimento.
- A conta atual consumiu **154 de 5.000 requisições no mês**; o sistema já bloqueia em 4.800 para manter margem de segurança.

## Alerta de custo

A mudança elevará o teto automático de 60 para **150 requisições por dia**. No uso máximo, isso representa cerca de **4.500 requisições por 30 dias** e custo estimado de até **US$ 4,80 por dia / US$ 144 por 30 dias**, antes de créditos ou franquias do Google. A quantidade real de leads varia conforme duplicidades, disponibilidade de telefone e resultados do Google.

A aprovação deste plano confirma esse novo teto de custo. Não será criado novo agendamento nem consulta contínua; o abastecimento continuará aproveitando o fluxo já existente.

## Implementação

1. **Aumentar o teto diário**
   - Alterar o limite automático para 150 requisições/dia.
   - Manter lotes controlados, trava contra execuções simultâneas, deduplicação e reserva-alvo de 600 contatos com WhatsApp.
   - Parar de buscar quando a reserva estiver suficiente, evitando consumir o teto sem necessidade.

2. **Adicionar a segunda conta com segurança**
   - Solicitar a segunda chave da Places API pelo formulário seguro após a aprovação; ela não será enviada pelo chat nem gravada na tela ou no código.
   - Manter a conta atual como principal e a nova como reserva.
   - Exigir que a conta reserva tenha faturamento e Places API (New) ativos.

3. **Troca automática em 4.800 requisições**
   - Controlar o consumo mensal separadamente para cada conta.
   - Usar a principal até 4.800 requisições e alternar automaticamente para a reserva.
   - Nunca voltar para a principal no mesmo mês depois da troca; os contadores reiniciam no primeiro dia do mês.
   - Se ambas atingirem 4.800, interromper novas buscas sem afetar os leads já captados nem o aquecimento existente.

4. **Visibilidade e alertas**
   - Mostrar no relatório diário qual conta está ativa, consumo individual, saldo das duas contas, quantidade captada e duplicidades ignoradas.
   - Avisar no WhatsApp quando houver troca para a conta reserva e quando as duas estiverem próximas do limite.
   - Não exibir as chaves nos relatórios, registros ou mensagens de erro.

5. **Validação**
   - Testar a contagem por conta, a troca simulada em 4.800, a trava diária de 150 e o bloqueio quando ambas se esgotarem.
   - Confirmar que buscas manuais e automáticas não ultrapassam o limite atribuído à respectiva conta.
   - Publicar as funções atualizadas e verificar os relatórios e registros de execução.

## Detalhes técnicos

- Será criada uma configuração persistente por provedor (`principal` e `reserva`) com consumo mensal, limite de segurança e estado ativo, protegida para uso exclusivo do servidor.
- A seleção da chave acontecerá somente no servidor antes de cada página da Places API, para que uma execução longa também consiga alternar sem ultrapassar 4.800.
- A cota automática diária de 150 será global entre as duas contas, não 150 para cada uma.
