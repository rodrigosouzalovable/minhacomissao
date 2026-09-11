# Confirmar reenvios recentes e exibir os contatos ignorados

## Situação confirmada

- Hoje, ao detectar contatos acionados no último dia, a confirmação informa que eles serão ignorados; o usuário só pode continuar assim ou cancelar.
- A função de envio remove esses contatos obrigatoriamente e bloqueia a campanha quando todos já foram acionados.
- As campanhas recentes do Thiago possuem o registro correto no banco. Por exemplo, há campanha com **76 contatos ignorados**, além de campanhas com 3 e 1.
- O painel mostra zero porque os campos `ignorados_repetidos` e `dias_antirrepeticao` não são preservados ao carregar a campanha para o diálogo.

## Alteração

1. **Dar uma escolha clara antes do disparo**
   - Quando houver contatos acionados no último dia, abrir uma confirmação com três decisões:
     - **Enviar para todos mesmo assim**;
     - **Ignorar os contatos recentes e enviar somente aos demais**;
     - **Cancelar**.
   - A mesma escolha ficará disponível quando todos os contatos forem recentes, em vez de bloquear imediatamente.
   - Mostrar a quantidade que será enviada em cada opção para evitar decisão acidental.

2. **Aplicar a decisão no envio real**
   - Enviar ao servidor a escolha feita pelo usuário.
   - Se escolher “enviar mesmo assim”, manter os contatos recentes na campanha.
   - Se escolher “ignorar”, conservar a proteção atual, remover os recentes e registrar a lista ignorada.
   - Manter comparação pelo final do telefone e janela global de 1 dia.

3. **Corrigir “Ignorados por envio recente”**
   - Preservar no carregamento da campanha a lista e a janela de antirrepetição retornadas pelo banco.
   - Exibir a quantidade e os contatos gravados, incluindo telefone, nome, data do último envio e campanha anterior.
   - Manter copiar e baixar Excel.
   - Quando o usuário escolher enviar mesmo assim, o bloco mostrará zero ignorados, pois nenhum contato foi retirado.

4. **Validar com o caso do Thiago**
   - Abrir uma campanha dele que já possui ignorados e confirmar que o painel exibe a quantidade real.
   - Testar as três decisões com lista parcialmente repetida e totalmente repetida.
   - Confirmar que “ignorar” não envia aos recentes e “enviar mesmo assim” inclui esses contatos uma única vez na nova campanha.

## Detalhes técnicos

- Ajustar o tipo e o conversor de campanhas no contexto para incluir `dias_antirrepeticao` e `ignorados_repetidos`.
- Substituir a confirmação simples da tela de Envio Meta por uma decisão explícita de reenvio.
- Acrescentar um sinal validado na função de início da campanha para autorizar o reenvio recente; sem autorização explícita, continuará valendo o bloqueio atual.
- Republicar a função de início da campanha e verificar a tela em desktop.
- Custo de nuvem: neutro; não será criado cron, polling ou consulta recorrente adicional.
