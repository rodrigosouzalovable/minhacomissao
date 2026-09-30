# Pausar o Certificado e controlar o custo por conversa do IAGO

## Objetivos

- Paralisar integralmente o projeto Certificado, sem apagar leads, conversas ou histórico.
- Concentrar a operação na caixa PADRÃO, atendida pelo IAGO.
- Mostrar para todos que acessam uma conversa quanto aquela conversa custou no mês.
- Adaptar os cálculos à cobrança por mensagem entregue vigente em 01/10/2026.
- Reduzir mensagens desnecessárias sem deixar clientes sem resposta.

## 1. Pausa segura do Certificado

- Desligar a coleta da Casa dos Dados e a prospecção automática.
- Desativar as duas agendas automáticas de coleta e envio; não apenas deixá-las rodando sem ação.
- Desativar a Clara na caixa CERTIFICADO.
- Cancelar as 406 reservas ainda pendentes e impedir que campanhas antigas retomem ao clicar em atualizar.
- Manter intactos leads, respostas, métricas, campanhas e conversas anteriores.
- Deixar a aba CERTIFICADO em modo somente leitura, com aviso claro: **Projeto pausado — nenhum novo envio ou atendimento automático**.
- Bloquear temporariamente os botões de coleta, preparação e disparo manual enquanto o projeto estiver pausado.

## 2. Registro confiável do custo de cada mensagem

Criar um registro financeiro por mensagem de saída entregue, ligado à conversa, ao número oficial e à origem:

- **IAGO**;
- **atendente humano**;
- **template/campanha**;
- **outra automação**.

Cada registro terá categoria da Meta, situação de entrega, valor, moeda, data, número remetente e grau de confirmação:

- **Confirmado pela Meta**: categoria e entrega recebidas no retorno oficial.
- **Estimado**: cálculo provisório enquanto o retorno oficial não chegou.
- **Gratuito**: franquia ou janela gratuita confirmada.

Somente mensagens entregues entram no custo. Tentativas, falhas e mensagens recebidas do cliente não serão cobradas no painel.

## 3. Nova regra de preços a partir de 01/10/2026

- Atualizar o cálculo que hoje considera `SERVICE` gratuito.
- Aplicar a tarifa vigente conforme país do destinatário e data da entrega, sem alterar o histórico anterior a 01/10.
- Controlar separadamente a franquia mensal de 1.000 mensagens de serviço por número oficial.
- Mostrar franquia usada e restante por número.
- Manter uma tabela de tarifas com vigência, evitando espalhar valores fixos pelo sistema.
- Conciliar diariamente os valores calculados por mensagem com o total agregado informado pela Meta; divergências ficam sinalizadas, sem substituir dados confirmados silenciosamente.

## 4. Custo explícito dentro da conversa

No cabeçalho de cada conversa da caixa PADRÃO, mostrar para todos os usuários com acesso:

- **Custo neste mês**;
- **mensagens entregues/cobradas/gratuitas**;
- **custo médio por resposta enviada**;
- selo **Confirmado** ou **Estimado**;
- separação **IAGO x equipe humana**.

Ao clicar no custo, abrir um detalhamento simples por mensagem, com horário, autor, categoria e valor. O total será mensal para não misturar anos de histórico no mesmo número; haverá opção de consultar outros períodos.

## 5. Painel de economia da caixa PADRÃO

Adicionar uma visão resumida, acessível sem consultas contínuas:

- custo hoje e no mês;
- custo médio por conversa atendida;
- custo médio por conversa resolvida;
- mensagens de saída por conversa;
- custo do IAGO e custo dos atendentes;
- conversas mais caras;
- custo por número oficial;
- consumo da franquia gratuita;
- projeção até o fim do mês;
- economia obtida após as otimizações.

A atualização será por evento de entrega e por botão **Atualizar**, sem polling frequente.

## 6. Redução de custos no atendimento do IAGO

### Aplicar imediatamente

1. **Uma resposta completa por vez**: juntar explicação, valores e próximo passo em um único envio sempre que couber.
2. **Agrupar mensagens consecutivas do cliente**: aguardar uma janela curta configurável, recomendada em 4 segundos, antes de responder à sequência.
3. **Evitar confirmações vazias**: não enviar “entendi”, “só um momento” ou “vou verificar” separadamente da resposta útil.
4. **Manter follow-ups desligados**, como já definido.
5. **Usar regras diretas antes da IA** para CPF, pedido de humano, número errado, documentos e respostas frequentes.
6. **Transferir uma única vez**: ao escalar, enviar no máximo uma confirmação ao cliente e não continuar respondendo em paralelo com o humano.
7. **Não fragmentar propostas**: enviar condições e pergunta final em um único bloco legível.

### Não aplicar automaticamente

- Não criar limite rígido que deixe clientes sem resposta.
- Não desligar o IAGO ao atingir orçamento sem antes encaminhar a conversa.
- Não trocar respostas úteis por mensagens excessivamente curtas apenas para economizar.

## 7. Alertas e metas

- Alertas visuais em 70%, 90% e 100% da franquia mensal de cada número.
- Meta inicial: reduzir a quantidade média de mensagens enviadas por conversa sem reduzir a taxa de resolução.
- Alerta de conversa cara quando ultrapassar um valor configurável; inicialmente apenas informa, sem bloquear atendimento.
- Relatório semanal comparando custo, resolução, escaladas e mensagens por conversa.

## 8. Implantação e validação

1. Pausar Certificado, Clara, reservas e agendas; confirmar que nenhum envio residual permanece elegível.
2. Criar o registro por mensagem e começar a classificar IAGO/humano/template.
3. Atualizar tarifas com vigência em 01/10 e validar a franquia por número.
4. Exibir custo no cabeçalho e detalhamento da conversa.
5. Adicionar painel da caixa PADRÃO.
6. Otimizar o formato das respostas do IAGO.
7. Testar com simulações, sem enviar mensagens reais.
8. Conferir permissões, versão móvel, compilação e conciliação com os totais da Meta.

## Impacto de operação

- A pausa do Certificado reduz consultas e envios.
- A medição acrescenta uma gravação pequena por mensagem entregue e consultas resumidas com índices; impacto baixo.
- Não será criado novo polling, canal em tempo real ou agenda frequente.
- O custo exibido por conversa será exato quando a Meta confirmar entrega/categoria e ficará identificado como estimativa antes disso.
