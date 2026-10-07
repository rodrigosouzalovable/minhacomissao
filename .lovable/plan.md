# Lembretes automáticos de parcelas atrasadas e busca por conteúdo

## Objetivo
Enviar lembretes pela Meta em **D+1, D+3 e D+7 após o vencimento**, somente enquanto a parcela continuar pendente, usando números GREEN e vinculando a conversa ao funcionário que lançou o acordo. Ampliar a busca de Templates HSM do Envio Meta para nome e conteúdo.

## Situação conferida
- Existe uma rotina Meta diária às **08:30 BRT**, atualmente voltada a D-3 e D0. Ela usa um template fixo e precisa ser adaptada para esta nova sequência e para as três variáveis.
- O modelo cadastrado **`novo_lembrete_envio_boleto_variavel`**, em português e categoria Utility, corresponde à segunda imagem e tem os botões **QUERO O BOLETO** e **JÁ TENHO O BOLETO**.
- O seletor de templates atualmente pesquisa apenas pelo nome, embora já mostre o texto da mensagem.
- Existem outras automações de lembretes; conferir seu alcance e configurações antes da ativação para não duplicar cobranças.

## 1. Sequência de cobrança
- Acrescentar a sequência de atrasados à configuração de Lembretes Meta, com controle próprio de ativar/pausar e seleção do template. Não ativar lembretes anteriores ao vencimento por consequência desta mudança.
- Considerar **dias corridos desde o vencimento**, em horário de São Paulo: D+1, D+3 e D+7, e não intervalos contados desde o último envio.
- Enviar somente para parcelas pendentes de acordos ativos, entre 1 e 10 dias de atraso. Parcelas pagas e acordos quebrados, concluídos ou cancelados ficam excluídos.
- Revalidar pagamento, vencimento e situação do acordo imediatamente antes de enviar. Uma baixa manual ou importação diária elimina os próximos lembretes.
- Não enviar aos domingos; adiar para segunda-feira pela manhã, a partir das 08h BRT. Se uma etapa ficar impedida por falta de remetente, mantê-la pendente até haver elegibilidade, sem ultrapassar D+10.
- Se mais de uma etapa estiver vencida, enviar somente a etapa mais recente aplicável, sem acumular mensagens antigas no mesmo dia. Evitar lembretes repetidos para o mesmo cliente/acordo na mesma execução.
- Na ativação, não disparar uma recuperação em massa de todas as etapas antigas: considerar somente a etapa atual aplicável, dentro do prazo.

## 2. Template e variáveis
Usar inicialmente **`novo_lembrete_envio_boleto_variavel`**, preservando o texto e os botões aprovados:

| Variável | Valor automático |
|---|---|
| `{{1}}` | Nome do cliente do acordo |
| `{{2}}` | Nome do credor vinculado ao acordo |
| `{{3}}` | Vencimento da parcela, em DD/MM/AAAA |

- Mostrar a prévia com dados reais antes da ativação; não repetir o nome do funcionário nas três variáveis.
- Bloquear o envio se faltar nome, credor, vencimento ou telefone válido, registrando o motivo.
- Permitir trocar o template para os próximos envios, com mapeamento e validação de todas as variáveis obrigatórias.
- **Observação:** o modelo escolhido diz “vence em”, mesmo quando usado após o vencimento. Ele será preservado; um texto diferente de cobrança de atraso dependerá de outro template aprovado, não de alteração livre durante o envio.

## 3. Remetentes GREEN e atendente correto
- Usar apenas instâncias oficiais conectadas, disponíveis para envio, com qualidade **GREEN confirmada**, sem bloqueio real, dentro da cota e com cópia aprovada do template Utility selecionado.
- Não usar UNKNOWN, YELLOW, RED, UAZAPI ou uma reativação manual para contornar essa exigência.
- Distribuir por rodízio entre as instâncias elegíveis, respeitando propriedade, permissões, blacklist por sufixo e limites da Meta.
- Restringir remetentes a caixas nas quais o funcionário do acordo seja atendente autorizado. Aplicar a atribuição e a etiqueta desse funcionário no Inbox, não do administrador que configurou a automação.
- **Decisão confirmada:** se não houver instância GREEN compatível com o funcionário, não enviar nem atribuir a outro operador. Deixar pendente e mostrar o impedimento no acompanhamento, sem ampliar permissões de caixas.
- Preservar o histórico; se uma conversa existente tiver atribuição incompatível, resolver pela atribuição autorizada da caixa ou deixar pendente, sem sobrescrever etiquetas indiscriminadamente.

## 4. Acompanhamento, custo e ativação
- Mostrar prévia dos destinatários, etapa, parcela, funcionário, remetente possível e estimativa de cobrança antes de ativar.
- Disponibilizar histórico de enviados, pendentes, falhas e impedimentos, com motivo, data e identificador da mensagem. Diferenciar mensagem aceita pela Meta de entrega confirmada.
- Disponibilizar pausa da sequência; falhas devem aparecer com explicações claras, sem tela em branco ou repetição imediata de envio incerto.
- **Custo autorizado com controle:** até três mensagens por parcela elegível, além das tarifas da Meta. Por exemplo, 100 parcelas que continuem atrasadas podem gerar até 300 mensagens; não necessariamente todas serão cobradas. Mostrar a estimativa pelas tarifas vigentes, sem prometer valor fixo.
- Reutilizar o agendamento diário existente e processamento limitado por lote, sem nova consulta contínua no navegador ou rotina permanente de alta frequência. Aumenta o processamento nos dias com pendências e o custo das mensagens; a capacidade diária deve ser conferida antes da ativação.
- Fazer validações sem mensagens reais. Ativar somente após conferir configuração e prévia de custo/destinatários com o responsável.

## 5. Busca por nome e texto no Envio Meta
- Pesquisar o **nome ou o corpo completo** do template no campo Templates HSM, não apenas as linhas visíveis do resumo.
- Ignorar diferenças de maiúsculas/minúsculas e acentos.
- Preservar favoritos primeiro, seleção atual, contagem de aprovações, prévia e regras de envio.
- Aplicar a ampliação no Envio Meta por opção do seletor compartilhado, sem mudar os demais seletores fora do pedido.
- Filtrar os dados já carregados, sem consultas adicionais.

## Detalhes técnicos
- Estender `meta-lembrete-tick` e a configuração/tela `LembreteMeta` com escopo de proprietário/empresa, sequência independente e identificação lógica do template; resolver a cópia aprovada por instância no servidor.
- Reutilizar o envio oficial e as verificações compartilhadas de saúde, supressão, autorização da caixa e atribuição, sem confiar em permissões enviadas pelo navegador.
- Conferir as automações concorrentes e as regras de baixa/importação para impedir duplicação entre rotinas.
- Reservar cada envio atomicamente no banco e garantir unicidade por parcela, vencimento e etapa; impedir duas execuções concorrentes. Limitar lote e duração, preservando pendências para retomada segura e sem laços ilimitados.
- Não reenviar automaticamente quando a aceitação pela Meta estiver incerta; registrar para conferência. Persistir progresso e pausa, respeitando as respostas de erro e limitações da Meta.
- Avaliar índices das consultas antes de acrescentá-las. Alterações de estrutura devem incluir permissões e isolamento adequados; não conceder leitura ampla de acordos, conversas ou configurações.
- Ampliar `TemplateFavoriteSelect` com busca por conteúdo habilitada somente no uso de `EnvioMeta`.

## Validação
- Testes concretos de D+1, D+3, D+7, exclusão em D0 e D+11, domingo/segunda e limite de uma etapa aplicável por dia.
- Testes de cancelamento por pagamento ou encerramento do acordo, inclusive baixa por importação antes do envio.
- Testes de GREEN obrigatório, template aprovado, bloqueios, supressão, caixa autorizada e pendência quando o funcionário não for elegível.
- Testes das variáveis com nome do cliente, credor e vencimento distintos; ausência de dados deve impedir envio.
- Testes de concorrência, deduplicação e retomada sem repetir etapas já aceitas.
- Testes de busca por nome e por frase presente somente no corpo, incluindo acentos e maiúsculas.
- Conferir prévia, configuração, pausa e histórico, sem disparar mensagens durante a validação.