# Prospecção manual do Certificado Digital por quantidade e instâncias escolhidas

## Resultado esperado

Na aba **Certificado Digital > Prospecção**, a área **Preparação** passará a permitir:

- informar livremente a quantidade desejada, sem limite fixo na tela;
- escolher uma ou várias instâncias da BM selecionada;
- clicar em **Iniciar processamento e envios** para buscar **novos CNPJs**, verificar WhatsApp e somente iniciar a campanha quando completar a quantidade solicitada;
- executar uma campanha manual adicional mesmo que o limite automático diário de 50 já tenha sido atingido.

## Alerta de custo

**Esta mudança pode aumentar de forma significativa o consumo da Casa dos Dados e do Lovable Cloud**, porque cada solicitação manual ignorará o estoque antigo e continuará consultando novas páginas até alcançar a quantidade informada. Quantidades altas também prolongam a verificação por WhatsApp e aumentam o volume da campanha.

Para evitar travamentos e cobranças causadas por uma execução longa, o trabalho será dividido em lotes limitados, sem criar novo agendamento permanente. A aprovação deste plano confirma esse comportamento e esse impacto.

## Alterações na tela

### Preparação

- Adicionar o campo **Quantidade de novos contatos com WhatsApp**.
- Aceitar qualquer número inteiro positivo informado pelo administrador.
- Mostrar o andamento em etapas: CNPJs consultados, novos encontrados, números verificados, confirmados com WhatsApp e quantidade restante.
- Manter o botão ocupado enquanto a solicitação estiver sendo preparada, evitando cliques duplicados.
- Se a data escolhida não tiver empresas suficientes, informar exatamente quantas foram confirmadas e não iniciar uma campanha parcial.

### Template, BM e instâncias

- Manter a ordem atual: primeiro template, depois BM compatível.
- Após selecionar a BM, exibir somente as instâncias dessa BM que possuem o template selecionado aprovado.
- Permitir marcar uma ou várias instâncias.
- Mostrar em cada opção nome, telefone, conexão, qualidade e disponibilidade no pool.
- Bloquear o início se nenhuma instância estiver marcada ou se todas as marcadas deixarem de estar conectadas, aprovadas ou disponíveis.
- Ao trocar template ou BM, limpar automaticamente as instâncias incompatíveis.

## Fluxo manual

1. Validar quantidade, template, BM e instâncias selecionadas.
2. Criar uma solicitação exclusiva com trava contra clique duplicado.
3. Consultar a Casa dos Dados para a data/faixa ativa, sempre procurando CNPJs ainda não armazenados e nunca completando a meta com o estoque anterior.
4. Verificar os telefones em lotes pelas instâncias UAZAPI verificadoras já selecionadas.
5. Continuar buscando novas páginas e verificando novos telefones até atingir a quantidade exata de WhatsApps inéditos.
6. Deduplicar por CNPJ e pelos últimos oito dígitos do telefone, respeitando blacklist, opt-out e contatos já usados em campanhas.
7. Criar a campanha somente depois de reservar a quantidade completa.
8. Distribuir os contatos em round-robin exclusivamente entre as instâncias Meta marcadas que continuarem aptas e com o template aprovado.
9. Iniciar os envios com o intervalo atual de 30 a 90 segundos e carregar a campanha no painel normal, com Pausar, Retomar, Cancelar e Ver detalhes.

## Limite automático separado

- O processo automático das 09h continuará com o limite diário configurado de 50.
- O processo manual não será bloqueado pelos 50 já enviados no dia e usará exatamente a quantidade digitada.
- Uma campanha manual não reutilizará contatos de campanhas anteriores.

## Execução segura em lotes

Como uma quantidade livre pode exceder o tempo de uma única execução:

- cada etapa processará um lote limitado e salvará o progresso antes de continuar;
- haverá uma única execução ativa por solicitação;
- cada CNPJ/telefone concluído ficará marcado para não ser processado novamente;
- a continuação ocorrerá somente enquanto faltar quantidade e ainda houver páginas disponíveis;
- falhas temporárias terão tentativas espaçadas e limitadas;
- indisponibilidade, falta de saldo ou esgotamento da data interromperá a preparação sem criar campanha incompleta;
- nenhum novo cron ou verificação permanente será criado.

## Estrutura técnica

- Guardar na configuração do Certificado as instâncias Meta selecionadas, com acesso administrativo e validação no servidor.
- Criar registro de preparação manual com quantidade-alvo, quantidade confirmada, página atual, estado, erro e trava temporária.
- Tornar a coleta retomável por página e a verificação retomável por lote.
- Separar o limite do pedido manual do `limite_diario` usado pela automação das 09h.
- Revalidar template, BM, instâncias, conexão, pool, qualidade e aprovação imediatamente antes de criar a campanha.
- Reservar os leads de forma atômica para impedir duas campanhas de usarem o mesmo contato.

## Validação

- Solicitar mais 50 depois dos 50 já enviados hoje e confirmar uma nova campanha com 50 contatos inéditos.
- Testar quantidade pequena e quantidade alta, incluindo retomada entre lotes.
- Confirmar que estoque antigo não entra na campanha manual.
- Confirmar que a campanha não nasce com quantidade parcial.
- Selecionar uma instância e várias instâncias; conferir o round-robin somente entre as marcadas.
- Trocar template/BM e confirmar a limpeza das seleções incompatíveis.
- Simular instância desconectada, template reprovado, falta de saldo e data sem CNPJs suficientes.
- Validar painel de campanha, pausa, retomada, cancelamento e visual em computador e celular.
