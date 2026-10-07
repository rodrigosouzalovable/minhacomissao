# Recuperação YELLOW/RED com template cadastral e contatos autorizados

## Objetivo e limites

Usar **`fins_de_atualizacao_cadastral`** na recuperação, alternando números UAZAPI conectados da caixa AQUECIMENTO e empresas do Google Maps autorizadas a receber mensagens. Incluir tanto respostas automáticas já confirmadas quanto candidatos, sem tratar uma possível resposta automática como confirmação.

Você confirmou que os contatos atuais autorizaram o recebimento e que a segunda variável deve ser o **nome da empresa destinatária**.

Interações não garantem retorno ao GREEN nem prazo de recuperação. A mensagem deve corresponder a uma confirmação cadastral legítima, não servir apenas para produzir respostas artificiais. Se a Meta reclassificar o modelo como Marketing ou bloquear o número, o fluxo não contornará essa restrição.

## Situação verificada

- O modelo mestre existe como Utility, com duas variáveis e os botões **SIM, CONFIRMO.**, **NÃO** e **SAIR**. A consulta encontrou **74 cópias aprovadas**; a marcação de aplicação automática em números novos está desligada nesse mestre.
- A recuperação atual seleciona somente UAZAPI conectados da caixa AQUECIMENTO. O template preferido não está configurado; a seleção permite outro Utility aprovado.
- O código limita a recuperação a 08h–19h BRT, sem domingos, com 10–20 mensagens diárias por remetente, intervalos aleatórios de 20–40 minutos e redução diante de piora.
- O reconhecimento geral de bloqueio aceita “sair da lista”, mas não a palavra isolada “SAIR”. Outro caminho, associado ao log de aquecimento, já registra opt-out como supressão; será necessário garantir blacklist persistente para o botão também no fluxo de recuperação, sem depender daquele log.

## Alterações propostas

### 1. Template único e variáveis exatas

- Usar exclusivamente o modelo aprovado `fins_de_atualizacao_cadastral` neste fluxo, sem substituir silenciosamente por outro.
- **{{1}} = `tudo bem?`**.
- **{{2}} = nome real completo da empresa destinatária**, sem abreviar e sem substituir por Souza e Ribeiro Advogados.
- Exemplo: “Olá tudo bem?, para fins de atualização cadastral, você confirma que falamos com Clínica Vida Nova neste contato?”
- Preservar texto e botões aprovados pela Meta. Não editar o corpo do template neste trabalho.
- Quando não houver nome empresarial confiável, aguardar correção do cadastro em vez de inventar um nome ou usar o apelido técnico da instância.
- Se o remetente não possuir a cópia aprovada, exibir o motivo e aguardar; não forçar envios.

### 2. Destinatários e rodízio

- Manter UAZAPI conectados da caixa AQUECIMENTO como uma fonte, sem incluir automaticamente todos os números pessoais conectados no sistema.
- Adicionar empresas com resposta automática confirmada e candidatos com possível resposta automática, identificando separadamente essas situações.
- Exigir WhatsApp confirmado, nome empresarial válido e autorização de recebimento para empresas externas. Sua confirmação sobre o estoque atual será registrada com escopo auditável; não será estendida automaticamente a futuras capturas.
- Candidatos continuam candidatos até uma resposta real comprovar a classificação; não presumir confirmação só porque houve entrega ou clique humano.
- Deduplicar todas as fontes pelo sufixo dos últimos oito dígitos, respeitando blacklist, opt-out e supressão de números sem WhatsApp.
- Alternar fontes e remetentes sem rajadas. Para empresas externas, usar cada contato uma única vez nessa rodada, globalmente entre os remetentes, sem recomeçar a lista apenas porque mudou o dia. Preservar limites atuais dos destinos UAZAPI.
- Revalidar elegibilidade imediatamente antes do envio e reservar destinatários de forma atômica para evitar duplicações entre ciclos simultâneos.

### 3. Botão “Sair” obrigatório

- Reconhecer o clique pelo identificador e pelo texto da resposta, nos formatos de botão enviados pela Meta.
- Registrar blacklist persistente por sufixo, com origem, horário e motivo de saída, sem depender de uma configuração opcional de blacklist.
- Impedir novos envios automáticos para esse contato, inclusive reservas ainda não enviadas, recuperação, campanhas e lembretes.
- Retirar o contato das fontes de recuperação e impedir que uma nova captura o recrie como elegível.
- Processar eventos repetidos sem duplicar registros; preservar histórico e bloquear respostas automáticas após a saída.
- “Sim, confirmo” registra confirmação cadastral. “Não” registra negativa e retira o contato desta rodada para conferência, sem confundir essa resposta com “Sair”.

### 4. Reposição de 100 leads

- Quando o estoque elegível de empresas estiver realmente esgotado por uso, solicitar **um lote com alvo de 100 novos leads**.
- Reaproveitar a captação existente, com trava contra pedidos simultâneos, deduplicação e os limites diários e mensais das contas Google.
- Não confundir falta de template, bloqueio do remetente, indisponibilidade temporária ou ausência de autorização com estoque consumido.
- Novos leads passam por verificação de WhatsApp, nome, blacklist e autorização antes de entrar no envio. Capturar não autoriza disparar.
- Se limites, duplicatas ou resultados insuficientes impedirem completar 100, mostrar o total obtido e o motivo, sem buscas ilimitadas para completar o alvo.
- UAZAPI continua disponível quando apto; falta de empresas não aumenta frequência nem volume por remetente.

### 5. Aplicação automática nas instâncias

- Marcar esse mestre como obrigatório para as instâncias próprias do mesmo dono, preservando isolamento entre usuários e contas parceiras.
- Auditar quais instâncias conectadas ainda não têm a cópia aprovada e reutilizar a fila existente, sem duplicar submissões já pendentes.
- GREEN recebe o modelo quando apto; UNKNOWN segue a elegibilidade já adotada pelo sistema. YELLOW/RED aguarda e recebe automaticamente ao voltar para GREEN.
- Preservar cotas de submissão: tier 250 com duas por número/dia; demais tiers seguem a fila sequencial existente.
- Respeitar bloqueios reais, categoria Utility e aprovação da Meta. Se uma instância cair antes de possuir o modelo, permanecerá sem esse disparo até ter uma cópia aprovada, conforme sua regra de não aplicar enquanto YELLOW/RED.

### 6. Conversas na AQUECIMENTO e resposta única do IAGO

- Registrar todos os envios deste fluxo e as respectivas respostas na caixa **AQUECIMENTO**, com o histórico, destinatário e instância remetente corretos.
- Não mover a instância inteira para outra caixa nem misturar o fluxo com atendimentos comuns. Se já existir uma conversa em outra caixa, preservar seu histórico e acesso; vincular o registro deste fluxo à AQUECIMENTO sem redistribuir silenciosamente o atendimento anterior.
- Para os destinatários deste novo fluxo, o IAGO responderá somente a uma confirmação explícita da identidade empresarial: clique em **“Sim, confirmo”** ou texto inequivocamente equivalente, associado ao envio cadastral.
- A única resposta será exatamente **“Obrigado pela confirmação”**, uma vez por confirmação desse envio, pela mesma instância e conversa autorizada.
- Resposta automática genérica, saudação, “Não”, dúvida, áudio ou qualquer resposta sem confirmação explícita não dispara mensagem do IAGO. “Sair” aplica a blacklist e não recebe agradecimento.
- Depois do agradecimento, nenhuma mensagem adicional do destinatário acionará outra resposta do IAGO neste fluxo: sem IA aberta, follow-up, transferência para humano ou nova confirmação repetida.
- Preservar o comportamento já existente dos números UAZAPI da AQUECIMENTO fora das conversas identificadas como parte deste novo fluxo.

## Detalhes técnicos

- Adaptar o motor de recuperação e seus auxiliares sem mudar inadvertidamente os outros fluxos que compartilham esses auxiliares.
- Reutilizar registros de recuperação, cadastros de leads, supressão por sufixo, captação e fila de onboarding. Confirmar os pontos de integração antes de implementar.
- Acrescentar somente os campos, reservas atômicas e índices necessários para autorização, consumo único e reposição controlada, com permissões administrativas e isolamento por dono.
- Manter os agendamentos atuais; não adicionar polling, canal Realtime nem cron novo.
- Mostrar no painel a fonte, nome empresarial, variáveis preenchidas, resultado e motivos de espera; separar mensagem aceita, entregue e resposta recebida.
- Identificar persistentemente as conversas deste fluxo e tratar confirmação/saída antes do atendimento genérico do IAGO. Reservar o agradecimento de forma idempotente para que eventos simultâneos não gerem duas respostas.

## Validação antes de ativar

- Testar as duas variáveis com valores exatos e bloquear nome ausente ou template diferente.
- Testar rodízio, consumo único, duplicatas por sufixo, reservas concorrentes e candidatos não confirmados.
- Testar “Sair” por clique, formatos distintos e repetição do evento; confirmar bloqueio em outras instâncias e em filas pendentes.
- Testar reposição única com alvo de 100, limites de consultas e autorização obrigatória dos contatos novos.
- Testar cópia automática na volta ao GREEN, cotas e espera de YELLOW/RED ou bloqueios reais.
- Confirmar envios e respostas na AQUECIMENTO, preservando históricos, autorização por caixa e atendimentos anteriores.
- Testar confirmação por botão/texto, repetição e eventos simultâneos: somente uma resposta exata “Obrigado pela confirmação”. Testar outras mensagens antes/depois, resposta automática, “Não” e “Sair”: nenhuma resposta adicional do IAGO.
- Fazer prévia sem envios reais e apresentar cobertura do template e estoque elegível antes de ativar a nova seleção de destinatários.

## Alerta de custo Lovable Cloud

**Esta alteração pode aumentar custos.** A reposição adicionará consultas Google e verificações de WhatsApp por lote de até 100 leads; 100 leads não equivalem necessariamente a 100 consultas. A recuperação manterá o teto atual de 10–20 mensagens/dia por remetente, mas poderá realizar mais envios quando hoje faltam destinos ou templates. Haverá no máximo um agradecimento por envio confirmado, sem chamada de IA para compor a resposta. A cobrança Meta depende da categoria efetiva e da janela da conversa, não apenas da categoria cadastrada.

O impacto adicional na Lovable Cloud será limitado por consultas paginadas e indexadas, reaproveitamento dos agendamentos e reposição somente por esgotamento, sem novas consultas contínuas. O valor em reais depende das contas Google, tarifas Meta e volume efetivo; não há estimativa monetária confiável sem esses dados.

**A aprovação do plano autoriza implementar esse custo adicional controlado; os testes não enviarão mensagens reais.**