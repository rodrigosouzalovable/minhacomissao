# Meta diária de 450 por BM e proteção contra desativação

## Diagnóstico confirmado hoje

- A Meta enviou dois alertas `ACCOUNT_VIOLATION`, às **17:49** e **17:53 (Brasília)**.
- As contas afetadas foram **DICEPAY** e **Harpiamed**.
- Nos dois casos, a própria Meta informou `violation_type: SCAM` — suspeita de fraude. Não informou `SPAM` nem quantidade de denúncias.
- Portanto, os dados disponíveis **não comprovam que houve muitas denúncias**. A classificação pode considerar conteúdo da mensagem, público abordado, links, identidade da empresa, padrão/velocidade de envio e sinais dos destinatários.
- Hoje também ocorreram **3.509 recusas #131031** em 9 números, **37 recusas #131042** em 13 números e 44 falhas #131026. Isso confirma que insistir após bloqueio está agravando falhas sem gerar conversas válidas.
- O aquecimento de hoje ficou abaixo das metas: Meus Acordos 159, Facebook Edna 42, Greensoul 35, Harpiamed 20, Avatus 1 e Horsegold 0 envios aceitos no fluxo de aquecimento.
- Há somente **47 leads Google Maps elegíveis agora**, insuficientes para sustentar 450 destinatários inéditos por BM.

## Regra principal

- Cada BM configurada terá meta operacional de **450 conversas novas aceitas por dia**, somando todos os números saudáveis daquela BM.
- Os 450 serão divididos entre os números elegíveis da BM; adicionar mais números à mesma BM não multiplicará a meta.
- BM em tier 250 não pode receber meta 450, pois a própria Meta limita a conta. Nela, o sistema manterá 20–30/dia até a promoção de tier. A meta 450 começa quando o limite oficial comportar esse volume.
- “450” será contabilizado somente após aceite da Meta, sem contar tentativas, falhas, duplicidades ou reenvios do mesmo destinatário.
- Não é possível garantir 450 quando a Meta bloquear a conta, faltar limite oficial, orçamento, template aprovado ou leads elegíveis. O painel mostrará claramente o impedimento em vez de registrar uma meta falsa.

## Alerta de custo alto

Com 10 BMs configuradas, 450 por BM representa até **4.500 novas conversas/dia**. Ao custo de referência atual de R$ 0,04 por conversa Utility, o teto teórico é cerca de **R$ 180/dia**, acima do orçamento atual de R$ 120/dia, além do custo do Google Maps.

O sistema não ultrapassará silenciosamente o orçamento. A execução distribuirá o saldo entre as BMs e mostrará quando o orçamento impedir a meta. Qualquer aumento do teto financeiro continuará exigindo decisão explícita.

## Implementação

1. **Planejamento por BM, sem multiplicação por número**
   - Trocar o alvo principal de “por número” para “por BM”.
   - Definir 450/dia para BMs cujo tier comporta esse volume e 25/dia para tier 250.
   - Dividir a meta entre os números GREEN ou UNKNOWN elegíveis, recalculando quando algum número sair do pool.
   - Manter YELLOW/RED, quarentena, pagamento, conta bloqueada e credenciais inválidas fora dos envios.

2. **Contagem real e recuperação durante o dia**
   - Contar destinatários únicos aceitos por BM em Brasília.
   - A cada rodada, calcular quanto falta para a BM e redistribuir apenas entre seus números saudáveis.
   - Priorizar as BMs mais atrasadas, sem permitir que uma BM consuma todo o estoque e deixe as demais zeradas.
   - Preservar deduplicação, carência de 15 dias e uso exclusivo de templates aprovados para leads.

3. **Pausa imediata da BM em `ACCOUNT_VIOLATION`**
   - Ao receber `SCAM`, `SPAM` ou outra violação de conta, pausar imediatamente todos os números da WABA afetada.
   - Cancelar novas tentativas dessa BM, devolver os leads não enviados à fila e preservar todo o histórico.
   - Não liberar a BM apenas porque um número aparece GREEN; exigir revalidação da conta e ausência de restrição.
   - Enviar aviso com BM, tipo da violação, horário e ação necessária, sem expor identificadores internos.

4. **Evitar repetição de bloqueios reais**
   - Interromper tentativas após #131031 e #131042 sem ficar recolocando o número repetidamente na mesma campanha.
   - Separar claramente: conta desativada por violação, conta bloqueada, pendência de pagamento e falha de entrega do destinatário.
   - Não interpretar `ACCOUNT_VIOLATION: SCAM` como prova de denúncia em massa.

5. **Painel diário para o administrador**
   - Exibir por BM: meta, enviados aceitos, faltantes, números em uso, tier, qualidade, bloqueios e motivo de não atingir 450.
   - Mostrar total do aquecimento separado das campanhas da base de cobrança.
   - Destacar “meta atingida”, “em andamento”, “limitada pelo tier”, “sem leads”, “sem orçamento” e “pausada pela Meta”.
   - Manter essas informações restritas ao administrador.

6. **Relatório e validação**
   - Enviar relatório matinal com a divisão dos 450 por BM e relatório final com realizado versus meta.
   - Validar DICEPAY e Harpiamed como pausadas por `SCAM` e impedir qualquer retomada automática insegura.
   - Testar redistribuição quando um número é bloqueado e confirmar que a meta da BM não é duplicada.
   - Acompanhar um dia real e conferir contagem, orçamento, estoque de leads e respostas da Meta.

## Limite externo ainda pendente

A captação de 500 contatos/dia continua dependente de cadastrar a chave Google Maps reserva e elevar a cota externa atual, que está limitada a 100 consultas/dia. Sem isso, não haverá estoque suficiente para sustentar 450 destinatários inéditos por BM.