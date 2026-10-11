# Aplicação gradual de templates a cada 2–5 minutos, 24/7

## O que foi confirmado
- A configuração geral está em 120–300 segundos, mas o processador usa exceções: tier 250 espera 10–15 minutos e tier ≥2.000 usa 30–60 segundos. A dose diária geral está desativada; o limite específico do tier 250 permanece separado.
- A aplicação manual usa apenas 1–1,5 segundo entre instâncias do lote. Portanto, ajustar somente a configuração geral não resolve todos os caminhos.
- Não foi confirmado que a velocidade de aplicação causou os três banimentos relatados. Reduzir o ritmo não garante aprovação nem evita todos os bloqueios da Meta.

## Alteração solicitada
1. **Intervalo aleatório de 2–5 minutos por número, dentro de cada BM**, entre uma submissão de template e a seguinte, em todos os tiers. Manter o teto de dois templates por número/dia BRT no tier 250; o intervalo não substitui essa cota.
2. **Aplicação gradual em todos os caminhos:** conexão de novos números, conferência de faltantes, aplicação manual, replicação e reenvio. O clique registra a solicitação e inicia as elegíveis; as demais aguardam sua vez, sem enviar todos os modelos imediatamente.
3. **Operação contínua:** manter 24 horas por dia, sete dias por semana, inclusive domingos. Não alterar horários de campanhas, mensagens ou lembretes.
4. **Evitar rajadas dentro da mesma BM:** alternar os números elegíveis, com submissões sequenciais e proteção compartilhada para contas WhatsApp usadas por mais de um número. O intervalo solicitado é por número, não uma pausa de 30–60 minutos para toda a BM.
5. **Aplicar o ritmo à fila existente:** reorganizar somente itens ainda não submetidos, distribuindo a retomada das pendências. Preservar templates enviados, aprovados ou em análise e seu histórico.
6. **Exibir a espera real:** indicar na fila o próximo horário permitido, a espera por intervalo ou cota e os bloqueios; atualizar avisos e previsão para o ritmo de 2–5 minutos. Não anunciar aprovação ao apenas enfileirar.

## Proteções
- Preservar propriedade, autorização, qualidade elegível, consultas válidas, deduplicação e pausas por reprovação.
- BMs e números com banimento ou restrição real confirmada não recebem templates; não reativar nem contornar bloqueios.
- Falhas inconclusivas não serão tratadas como ausência de template nem como confirmação de banimento.
- Manter o intervalo mesmo após novo clique, nova conexão, auditoria ou execução concorrente.

## Detalhes técnicos
- Centralizar o intervalo em segundos (mínimo 120, máximo 300), removendo os atalhos por tier e o envio manual em rajada.
- Reutilizar a fila e o processador existentes; conferir todos os pontos de criação antes de unificar sua admissão.
- Persistir a próxima elegibilidade e reservar o processamento atomicamente no banco, com proteção por número e conta WhatsApp e sequenciamento por BM. Não depender apenas de espera em memória ou bloqueio do botão.
- Separar os motivos de adiamento por intervalo e por cota diária; esperar 2–5 minutos não deve adiar automaticamente para o dia seguinte nem habilitar a cópia de outros modelos numa aplicação manual.
- Usar leituras limitadas e índices adequados, sem novo agendamento, aumento de frequência ou novo acompanhamento periódico. O agendamento existente pode fazer a execução ocorrer após o horário mínimo sorteado; não prometer precisão de segundos.
- Registrar a preferência de intervalo e a decisão técnica durante a implementação.

## Validação
- Testar os limites concretos de 120 e 300 segundos em todos os tiers e caminhos.
- Testar cliques repetidos e execuções concorrentes: nenhum segundo envio para o mesmo número ou conta antes de sua elegibilidade, nenhuma duplicação.
- Testar alternância entre números da BM e preservação dos bloqueios reais.
- Testar o máximo de duas submissões no tier 250 e a retomada no próximo dia BRT, inclusive domingo.
- Testar madrugada, domingo, reagendamento de pendentes e preservação dos já submetidos.
- Conferir no navegador os estados de fila e espera, sem mensagens a clientes; verificar os registros após a implementação antes de afirmar que o novo ritmo está ativo.

## Custo
Reutilizar a automação e a autorização existentes, sem aumentar a frequência das verificações. A proposta reduz a velocidade das submissões; não adiciona consultas periódicas. Caso a implementação exija algo que aumente custos, apresentar o impacto e pedir confirmação antes de fazê-lo.