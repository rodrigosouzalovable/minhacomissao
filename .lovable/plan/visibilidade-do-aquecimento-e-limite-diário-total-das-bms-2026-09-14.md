# Visibilidade do aquecimento e limite diário total das BMs

## Situação atual verificada

- Existem **62 números marcados para aquecimento**, distribuídos em **11 BMs**.
- O planejamento de hoje incluiu **17 números de quatro BMs**:
  - BM Meus Acordos: 5 números, alvo total de 2.250 contatos;
  - BM Rodrigo Ribeiro / Facebook Avatus: 10 números, alvo total de 670;
  - BM Greensoul: 1 número, alvo de 450;
  - Facebook Edna: 1 número, alvo de 80.
- Portanto, **nem toda BM marcada envia automaticamente todos os dias**. Cada número só entra quando está ativo, ligado à API Oficial Meta, marcado para aquecimento, com credenciais válidas, fora de quarentena/pausa/recuperação, com qualidade GREEN ou UNKNOWN e com o pool em estado ativo.
- A maioria dos números que não entrou hoje está em **“aguardando templates”**, sem leitura completa de saúde ou ainda com nome pendente. YELLOW e RED também ficam fora deste aquecimento.
- Nos últimos sete dias houve envios de aquecimento em quatro BMs: Meus Acordos, Facebook Edna, Avatus e Greensoul. O banco registra **983 envios aceitos**, além de muitas tentativas recusadas principalmente por pagamento da conta (`#131042`), conta bloqueada (`#131031`) e destino não entregável (`#131026`). O número 968 mostrado pela Meta pode divergir porque a Meta e o sistema não necessariamente contam o mesmo evento/período.
- Hoje o planejamento já foi criado às 07h BRT, mas o envio começa somente dentro da janela configurada, a partir das 08h BRT. Domingo continua bloqueado.

## Alteração na aba API Oficial Meta

Adicionar um resumo visível chamado **“Limite diário total das BMs”**:

- Somar o tier efetivo de cada BM ativa que possua ao menos um número Meta ativo vinculado.
- Contar cada BM **uma única vez**, independentemente da quantidade de números nela.
- Exemplo: uma BM de 2.000 acrescenta 2.000 ao total; conectar outro número à mesma BM não duplica esse valor.
- Ao vincular a primeira instância de uma nova BM ou alterar o tier da BM, o total será atualizado.
- Mostrar também quantas BMs compõem a soma e, em apoio, o total usado e o saldo das últimas 24 horas.
- Se alguma BM estiver configurada como ilimitada, indicar isso claramente sem produzir um total numérico enganoso.

Pelos dados atuais, o cálculo existente retorna **13 BMs com números vinculados e limite combinado de 27.000 mensagens por 24 horas**. A implementação validará somente BMs ativas com instâncias Meta ativas para evitar contar cadastros antigos ou inativos.

## Detalhes técnicos

- Reaproveitar a consulta de cotas já usada na tela, sem criar polling, cron ou atualização automática adicional.
- Ajustar a consulta consolidada para considerar somente BMs ativas e instâncias Meta ativas vinculadas.
- Calcular o total no cliente a partir de uma linha por BM, evitando multiplicação pela quantidade de números.
- Inserir o resumo no topo da aba API Oficial Meta, mantendo os cards individuais e as regras atuais de cota.
- Validar os casos: várias instâncias na mesma BM, BM sem instância, BM inativa, tier automático, tier manual e tier ilimitado.

## Impacto de custo

Sem novo cron, polling, canal em tempo real ou chamada à Meta. A tela reutilizará a consulta já existente; o impacto adicional no Lovable Cloud é desprezível.
