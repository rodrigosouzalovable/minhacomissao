# Lentidão persistente: aviso do Cloud e correção

## O que significa o aviso da imagem
"A instância do Cloud precisa de atenção" quer dizer que o servidor do banco de dados está trabalhando no limite. O alerta registrado foi de **leitura de disco esgotada**: o servidor tem uma cota de leitura de disco e ela caiu para 33%. Quando essa cota acaba, todas as consultas ficam lentas ao mesmo tempo, em todas as telas. É isso que a equipe sente como "só carregando".

## O que medi agora
- O banco tem **3,4 GB** e a memória está em torno de 90%. Os maiores itens são as mensagens do Inbox (831 MB), os devedores (544 MB) e os contatos do Inbox (414 MB).
- **Agora mesmo**, a lista de conversas do Inbox Meta levou **3,7 segundos** para uma única abertura.
- As correções de antes já resolveram o contador de não lidas, que caiu de 9 s para 0,002 s. A lista de conversas continua pesada.

## O que vou fazer
1. **Lista de conversas do Inbox Meta:** medir a consulta exata com o plano do banco. Depois, criar o índice que corresponde ao filtro usado: caixa, arquivadas, conversas de campanha separadas e ordem pela última mensagem. A meta é ficar abaixo de 50 ms.
2. **Outras consultas pesadas atuais** (mensagens por instância, templates, pagamentos em Acordos da Equipe): repetir a mesma medição e criar índices onde faltarem.
3. **Zerar as estatísticas e medir de novo** depois das mudanças, para comparar com números reais.
4. **Aumentar o servidor do banco (recomendado):** mesmo com as consultas otimizadas, o banco de 3,4 GB não cabe na memória do servidor atual. Por isso ele lê do disco o tempo todo e esgota a cota de leitura. Vou abrir a opção de tamanho para você escolher e aprovar.

## Custo
- Os itens 1 a 3 não aumentam o custo; eles diminuem o uso.
- **⚠️ ALERTA DE CUSTO:** o item 4 aumenta o custo mensal do Lovable Cloud, de acordo com o tamanho que você escolher. Ele só acontece se você aprovar na caixa de escolha. O próximo tamanho acima costuma ser suficiente.

## Detalhes técnicos
- Rodar `EXPLAIN (ANALYZE, BUFFERS)` na consulta da lista: `arquivado`, `folder_id is null`, `or(ultima_msg_entrada_em not null, fixado)`, `order ultima_mensagem_em desc limit N`, sob RLS. Índice parcial candidato: `(ultima_mensagem_em desc) where folder_id is null and arquivado=false and (ultima_msg_entrada_em is not null or fixado)`.
- Mesmo processo para `meta_whatsapp_mensagens (instancia_id, timestamp_msg)` e para `meta_whatsapp_templates`.
- Usar a ferramenta de redimensionamento do servidor, que pede a aprovação do usuário.
