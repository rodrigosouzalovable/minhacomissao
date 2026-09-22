# Piloto de prospecção para Certificado Digital

## Objetivo

Transformar a aba **Certificado Digital** em um piloto controlado: escolher uma BM, administrar o pool geral dos números vinculados, selecionar o template, confirmar sua aprovação e iniciar com até **50 mensagens por dia** somente para contatos previamente confirmados no WhatsApp.

## Nova área “Prospecção”

Adicionar uma nova aba interna, separando a coleta atual da operação de envio:

- **Leads e coleta:** mantém os controles e a lista atuais.
- **Prospecção:** concentra BM, números, template, verificação e acompanhamento do piloto.

A Prospecção mostrará um checklist obrigatório antes da ativação:

1. BM piloto selecionada.
2. Pelo menos uma instância Meta conectada e apta no pool.
3. Template selecionado e aprovado nas instâncias participantes.
4. Pelo menos uma instância UAZAPI conectada e marcada para verificar WhatsApp.
5. Contatos elegíveis e confirmados no WhatsApp.
6. Limite diário definido em 50.

O botão **Iniciar piloto** permanecerá bloqueado enquanto algum requisito não estiver atendido.

## Seleção da BM e pool geral

- Permitir selecionar uma única BM ativa como piloto.
- Listar somente as instâncias Meta vinculadas à BM escolhida.
- Em cada instância, exibir telefone, conexão, qualidade, tier, disponibilidade de envio, situação do pool e motivo de eventual bloqueio.
- Disponibilizar **Ativar Pool** e **Desativar Pool**.
- Conforme definido, esses botões controlarão o **pool geral da BM**, portanto também poderão afetar campanhas, aquecimento e outros envios que utilizem essas instâncias.
- A ativação reutilizará a validação oficial já existente; não permitirá contornar banimento, desconexão, restrição real ou indisponibilidade de envio.
- A retirada continuará manual e permanente até nova ativação explícita.
- Trocar a BM do piloto pausará o piloto atual e exigirá nova conferência antes de iniciar.

## Template e auditoria por instância

- Listar os templates disponíveis para a BM, com nome, idioma, categoria e prévia.
- Permitir escolher apenas um template para o piloto.
- Criar o botão **Verificar template nas instâncias**.
- A verificação sincronizará o estado real com a Meta e mostrará, por instância:
  - Aprovado;
  - Pendente;
  - Reprovado;
  - Ausente;
  - Falha temporária na consulta.
- O envio utilizará somente instâncias em que o mesmo template e idioma estejam aprovados.
- Se nenhuma instância elegível possuir o template aprovado, o piloto não poderá ser ativado.
- Se parte das instâncias estiver aprovada, o sistema poderá iniciar apenas com essas, deixando as demais claramente fora do envio.

## Verificação imediata de WhatsApp via UAZAPI

Na aba **UAZAPI**, adicionar em cada card, somente para o administrador proprietário, o controle **Verificar números**:

- poderão ser marcadas várias instâncias;
- apenas instâncias marcadas, ativas e conectadas participarão da verificação;
- credenciais não serão enviadas pela tela: o servidor selecionará as instâncias autorizadas;
- os lotes serão distribuídos em round-robin entre as verificadoras conectadas;
- se uma falhar, o lote tentará outra marcada;
- se todas falharem, os contatos ficarão como **não verificados**, nunca como “sem WhatsApp”.

Ao entrar um novo lead do Certificado Digital com telefone:

- normalizar o número;
- deduplicar por CNPJ, telefone e sufixo dos últimos 8 dígitos;
- verificar imediatamente se possui WhatsApp usando somente o pool UAZAPI escolhido;
- registrar **com WhatsApp**, **sem WhatsApp**, **não verificado** ou **erro temporário**, data da checagem e instância verificadora;
- somente leads confirmados com WhatsApp poderão entrar na fila do piloto;
- oferecer **Reverificar pendentes** manualmente, sem transformar falhas técnicas em números inválidos.

A coleta diária já existente acionará essa etapa após inserir os novos leads; não será criado outro cron.

## Envio do piloto

- Limite agregado inicial: **50 mensagens por dia para a BM**, não 50 por número.
- Distribuição round-robin somente entre instâncias Meta:
  - vinculadas à BM selecionada;
  - conectadas e disponíveis;
  - ativas no pool geral;
  - sem bloqueio, banimento, quarentena ou pausa;
  - com o template aprovado.
- Respeitar domingos bloqueados, janela BRT, limites oficiais da BM/número e regras especiais de tier 250.
- Reservar o contato antes do envio para impedir duplicidade por execução concorrente.
- Não reenviar ao mesmo CNPJ/telefone durante o piloto.
- Excluir blacklist, descadastros, sem WhatsApp, não verificados e contatos já enviados.
- Pausar automaticamente o piloto se não houver instância elegível ou se a Meta devolver bloqueio real.
- Não reutilizar a BM Greensoul nem interferir no piloto de aquecimento dela, salvo se ela for escolhida conscientemente nesta nova área.

## Controle e acompanhamento

Adicionar controles:

- **Piloto ativo/desativado**;
- limite diário, inicialmente 50;
- botão **Verificar tudo agora** para saúde, pool e template;
- botão **Pausar piloto**;
- confirmação antes de ativar/desativar o pool geral;
- resumo diário: elegíveis, enviados, entregues, lidos, respostas, falhas, sem WhatsApp e pendentes de verificação;
- histórico por BM, instância, template e lead;
- motivo legível para cada contato não enviado.

## Ideias recomendadas incluídas

- **Modo simulação:** antes do primeiro envio, mostrar quantos leads seriam usados e quais instâncias participariam, sem disparar nada.
- **Mensagem teste:** enviar o template para um número informado pelo administrador antes de liberar o piloto.
- **Freio de qualidade:** impedir novos envios quando a saúde oficial indicar risco, sem retirar outras instâncias saudáveis.
- **Aumento manual de volume:** manter 50/dia até análise dos resultados; qualquer aumento exige ação explícita, sem progressão automática nesta primeira versão.
- **Opt-out permanente:** qualquer pedido de não contato entra na supressão e não volta a campanhas futuras.

## Alterações técnicas

- Criar configuração administrativa do piloto com BM, template, limite, estado e auditoria.
- Criar vínculo seguro das instâncias UAZAPI autorizadas para verificação.
- Acrescentar ao lead o estado da verificação e sua rastreabilidade.
- Criar fila e registros de envio específicos de Certificado Digital, com índices para data, estado, telefone e BM.
- Aplicar permissões administrativas, RLS e grants em todas as novas estruturas.
- Reaproveitar as rotinas existentes de coleta, sincronização de templates, saúde Meta e controle do pool.
- Implementar validação de acesso no servidor e nunca aceitar endereço/token de UAZAPI enviado pela tela.
- Atualizar os tipos gerados e documentar as regras do piloto.

## Validação

- Testar seleção e troca de BM.
- Testar ativação/desativação do pool geral e seus avisos.
- Confirmar os cinco estados de template por instância.
- Confirmar que apenas UAZAPIs marcadas verificam números.
- Simular queda de uma verificadora e troca segura para outra.
- Confirmar que erro técnico não marca contato como sem WhatsApp.
- Confirmar teto agregado de 50 mensagens/dia e deduplicação.
- Confirmar bloqueio aos domingos e pausa por restrição real.
- Validar visualmente a aba em desktop e celular e conferir a compilação e os registros de execução.

## Custo e impacto

**Alerta de custo:** a verificação imediata fará chamadas UAZAPI para cada novo telefone e o envio consumirá mensagens de template da Meta. Haverá crescimento moderado dos registros de verificação e envio. Para reduzir impacto, o plano reutiliza o agendamento diário existente, usa lotes, índices, paginação, cache de números já verificados e não adiciona polling, Realtime ou novo cron. O limite inicial fica em 50 mensagens/dia.
