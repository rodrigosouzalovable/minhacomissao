# Várias chaves do Google Maps com identificação por conta

## Situação confirmada

- A tela e as funções atuais aceitam somente duas posições fixas: **principal** e **reserva**.
- O consumo mensal registrado está em **429 requisições na principal** e **12 na reserva**.
- A busca já troca de chave ao atingir o corte interno de **4.800 requisições** ou quando o Google responde que a cota daquela conta acabou.
- A estratégia existente permanece: meta de **500 WhatsApps confirmados por dia**, teto global de **300 consultas Places por dia**, captação antecipada e interrupção quando houver estoque suficiente.

## Alerta de custo

Adicionar contas aumenta a capacidade total disponível. Cada chave poderá consumir até **4.800 requisições por mês**; portanto, três contas permitiriam até 14.400 antes dos cortes individuais. Porém, o teto global continuará em **300 consultas por dia** entre todas as chaves — aproximadamente 9.000 em 30 dias — e o sistema continuará parando antes quando atingir a meta/estoque.

O custo bruto máximo desse teto pode chegar a aproximadamente **US$ 288 por 30 dias**, antes das franquias e créditos independentes do Google. As franquias podem reduzir ou zerar o valor, mas o sistema não tratará isso como garantia de cobrança zero.

## Implementação

1. **Transformar as duas posições em uma lista expansível**
   - Criar cadastro protegido de contas Google Maps com: identificador, e-mail da conta Google Cloud, chave, ordem de uso, status, datas de criação/alteração e limite mensal de segurança.
   - Migrar as chaves principal e reserva atuais para os dois primeiros registros, preservando os contadores mensais existentes.
   - Manter as chaves invisíveis depois de salvas; mostrar somente os quatro últimos caracteres.

2. **Nova administração de chaves na aba Google Maps Leads**
   - Mostrar cada conta em uma linha/cartão com e-mail, final da chave, consumo do mês, limite e estado: disponível, em uso, esgotada ou desativada.
   - Adicionar o campo obrigatório **E-mail da conta Google Cloud** abaixo do campo da chave.
   - Criar o botão **Adicionar outra chave** para abrir um novo cadastro.
   - Permitir testar, substituir, desativar/remover e reorganizar a prioridade de cada conta.
   - Manter essa administração visível somente para o login de administrador.

3. **Uso automático de qualquer quantidade de contas**
   - Selecionar a primeira conta ativa, válida e abaixo de 4.800 conforme a ordem configurada.
   - Ao atingir 4.800 ou receber erro de cota do Google, marcar a conta como indisponível no mês e repetir a requisição uma única vez com a próxima chave.
   - Continuar com as próximas contas cadastradas, sem depender dos nomes “principal” e “reserva”.
   - Reiniciar a elegibilidade mensal no primeiro dia do mês, preservando o histórico de consumo.
   - Se todas estiverem esgotadas ou inválidas, interromper novas buscas sem afetar os leads já captados.

4. **Contagem, relatórios e segurança**
   - Contabilizar cada consulta na conta realmente utilizada, inclusive testes manuais.
   - Atualizar o painel e o relatório diário com e-mail mascarado, consumo individual, conta em uso e capacidade total disponível.
   - Nunca incluir a chave completa em respostas, registros, relatórios ou mensagens de erro.
   - Proteger o cadastro no servidor e validar chave/e-mail tanto na tela quanto no servidor.

5. **Compatibilidade e validação**
   - Atualizar busca manual, abastecimento automático, verificação de limite e relatório diário para a lista dinâmica.
   - Simular troca no limite, erro 429, chave inválida, remoção da conta ativa e esgotamento de todas as contas.
   - Confirmar que o teto continua sendo **300 consultas diárias no total**, e não 300 por chave.
   - Publicar as funções atualizadas e testar uma busca real curta usando a conta selecionada automaticamente.

## Detalhes técnicos

- A mudança será aditiva: a configuração antiga será mantida temporariamente como compatibilidade, enquanto as funções passam a usar a nova lista.
- A tabela de contas não terá leitura direta pelo navegador; somente funções administrativas autenticadas poderão cadastrar ou alterar chaves.
- O histórico mensal passará a usar o identificador permanente da conta, evitando misturar consumo ao alterar o e-mail, a ordem ou a chave.
- A seleção será sequencial por prioridade, não paralela, para evitar duplicidades e ultrapassagens concorrentes de cota.
