# Aceleração segura do tier da BM Green Soul

## Objetivo
Aumentar a chance de a BM Green Soul evoluir para 10 mil usando destinatários únicos entregues, mantendo qualidade GREEN e evitando repetição artificial, reclamações e bloqueios.

## Diagnóstico confirmado
- A BM piloto está GREEN e o piloto está ativo com rampa configurada em 450 → 550 → 650 contatos únicos por dia.
- Nos últimos sete dias foram 800 destinatários únicos tentados, 757 entregues e 394 respostas.
- Nos leads do Google Maps, foram 714 únicos entregues e 394 respostas: 55,2% de resposta sobre entregues.
- A base de respostas automáticas contém 639 telefones, mas 486 já foram usados nos últimos sete dias.
- Somente 153 estão fora da janela de sete dias; destes, apenas 29 possuem confiança de classificação igual ou superior a 80%.
- Há uma divergência a corrigir: o acompanhamento do piloto registrou tier 2.000, enquanto o cadastro geral da BM ainda registra 1.000.

## Estratégia

### 1. Sincronizar o tier oficial antes de acelerar
- Consultar diretamente o limite atual informado pela Meta para a BM.
- Fazer todos os painéis e cálculos usarem o mesmo valor oficial.
- Definir automaticamente a distância para o próximo patamar com base em únicos realmente entregues, não em tentativas ou mensagens repetidas.

### 2. Tornar a métrica do piloto confiável
O painel da Green Soul passará a separar claramente:
- únicos tentados;
- únicos entregues na janela móvel de sete dias;
- lidos;
- respostas humanas;
- respostas automáticas;
- respostas positivas, negativas, número errado e pedido de retirada;
- falhas, bloqueios e denúncias conhecidas.

A evolução da rampa considerará entregas únicas e qualidade das respostas. Responder não será tratado automaticamente como sinal positivo.

### 3. Manter Google Maps como fonte principal, com seleção melhor
- Priorizar nichos e cidades com melhor entrega, leitura e resposta positiva/automática.
- Retirar imediatamente nichos com reclamações, recusas elevadas ou números errados.
- Excluir contatos já usados na janela móvel e deduplicar pelo final do telefone.
- Respeitar bloqueios, pedidos de retirada e contatos inelegíveis antes de cada envio.
- Manter a Green Soul como única BM do piloto.

### 4. Usar os 639 respondedores automáticos somente como reserva controlada
Não retornar para todos os 639. A resposta automática indica funcionamento do WhatsApp, mas não interesse comercial e não transforma repetição em novo destinatário único dentro da mesma janela.

Aplicar estas regras:
- nunca reutilizar dentro de sete dias;
- começar somente pelos 29 contatos hoje disponíveis com confiança de pelo menos 80%;
- usar no máximo 5% a 10% da meta diária como complemento, nunca como fonte principal;
- excluir qualquer contato com recusa, pedido de retirada, número errado ou sinal de reclamação;
- limitar a uma nova tentativa por contato após intervalo mínimo configurado;
- interromper o reaproveitamento se entrega, leitura, qualidade ou respostas negativas piorarem.

Os outros 124 contatos fora da janela, mas com confiança inferior a 80%, permanecem fora até nova validação. Os 486 usados recentemente não serão reutilizados agora.

### 5. Rampa baseada nos resultados
- Permanecer em 450/dia enquanto o tier oficial e a qualidade das respostas não estiverem confirmados.
- Avançar para 550 somente com GREEN, entrega mínima de 95%, falhas abaixo de 3% e baixa taxa de respostas negativas.
- Avançar para 650 nas mesmas condições após mais um dia saudável.
- Reduzir 30% entre 3% e 5% de falhas; pausar acima de 5%.
- Pausar imediatamente em YELLOW, RED, restrição, denúncia relevante ou crescimento de recusas.
- Encerrar automaticamente ao confirmar tier 10 mil.

### 6. Acompanhamento diário da decisão
Adicionar ao acompanhamento da Green Soul:
- tier oficial e horário da última confirmação;
- progresso de únicos entregues em sete dias;
- quantidade estimada restante para o próximo patamar;
- distribuição entre novos leads e respondedores automáticos reaproveitados;
- taxa de resposta positiva, automática e negativa;
- recomendação do dia: manter, avançar, reduzir ou pausar, com motivo visível.

## Meta operacional inicial
Se o tier oficial for 2.000, a referência operacional será alcançar pelo menos 1.000 destinatários únicos entregues na janela móvel, mantendo GREEN. Com os 757 atuais, a distância observada é de aproximadamente 243 únicos entregues, sujeita à confirmação oficial da Meta.

Se o tier oficial ainda for 1.000, o sistema recalculará a meta correta em vez de continuar usando números divergentes.

## Segurança e conformidade
- A estratégia não promete promoção: a decisão final é da Meta.
- Telefone público no Google Maps não será tratado como consentimento automático.
- Toda mensagem deve identificar o remetente, ter finalidade legítima e permitir recusa.
- Repetição para respondedores automáticos será apenas um teste pequeno e controlado, não uma fazenda de aquecimento.

## Impacto de custo
**ALERTA DE CUSTO LOVABLE CLOUD:** a implementação adicionará consultas resumidas e indexadas ao acompanhamento diário, sem novo cron, polling ou canal em tempo real. O impacto de infraestrutura estimado é baixo. O custo relevante continuará sendo o das mensagens Meta e das consultas de leads, respeitando os limites existentes.

## Validação
- Confirmar o tier oficial e eliminar a divergência 1.000/2.000.
- Conferir que nenhum telefone usado nos últimos sete dias seja reaproveitado.
- Simular avanço, redução e pausa da rampa.
- Validar que recusas e pedidos de retirada removam o contato de futuros envios.
- Confirmar no painel que tentativas, entregas únicas e tipos de resposta não sejam misturados.
