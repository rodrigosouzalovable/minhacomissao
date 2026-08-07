# IAGO — atendente de IA na fila do Inbox Meta Oficial

IAGO RIBEIRO DE SOUZA passa a existir como um atendente comum do sistema: tem perfil, tem etiqueta própria, entra na fila de atendimento das caixas em que você marcar ele no menu "Atendentes desta caixa" e conversa com o cliente como um humano. Tudo que ele pode falar/fazer é ensinado por você em **Usuários > IAGO RIBEIRO DE SOUZA**.

## Como vai funcionar

1. **Ele é um usuário de verdade.** Criado como perfil ativo, com etiqueta `Atendente: IAGO Ribeiro de Souza` e entrada na fila de atendimento — igual aos humanos. Você marca ele nas caixas pelo botão direito > "Atendentes desta caixa". Ele só atende conversas que caírem para a etiqueta dele, nas caixas onde estiver marcado.
2. **Atende 24h/7 dias.** Sem janela de horário para responder o cliente.
3. **Fala como humano.** Sem "sou uma assistente virtual", sem emoji em excesso, mensagens curtas, quebradas em 1–2 partes, com pequeno atraso de digitação (alguns segundos) para não parecer robô. Assina como IAGO quando fizer sentido.
4. **Aprende com as negociações reais.** Um rotina diária lê as conversas dos operadores que terminaram em acordo lançado, extrai os padrões que funcionaram (abordagem, resposta a objeções, forma de fechar) e guarda um resumo de aprendizado que passa a orientar o IAGO. Nada de valores inventados: os números continuam vindo do sistema (débitos, desconto à vista, grade 4x–24x, parcela mínima R$ 100).
5. **Follow-up único, dentro da janela de 24h.** Se o cliente não responder, IAGO retoma **uma vez, 2 horas depois**, e somente entre **08h e 19h** (se as 2h caírem fora, ele espera a próxima janela e ainda dentro das 24h da última mensagem do cliente). Depois disso não insiste mais. Se o cliente voltar a falar, ele responde normalmente e o follow-up é cancelado.
6. **Dúvida que ele não sabe responder → "Aguardando Humano".** Sempre que a resposta não estiver coberta pelo que você ensinou/pelos dados do sistema, ou quando o cliente escolher uma opção para fechar, ele para de responder, aplica a etiqueta **Aguardando Humano** e avisa os contatos de emergência. IAGO nunca lança acordo.
7. **"BLOQUEAR CONTATO" → silêncio.** Se o cliente responder isso (ou variações como "bloquear", "não quero mais receber", "sair da lista"), IAGO não responde nada, marca a conversa como opt-out e nunca mais manda follow-up ali.
8. **Nunca atropela humano.** Se qualquer atendente escrever na conversa, IAGO se cala naquela conversa.

## Aba de ensino: Usuários > IAGO RIBEIRO DE SOUZA

No card do IAGO em Usuários aparece o botão **"Configurar IAGO"** (só admin), com abas:

- **Personalidade**: nome de exibição, tom de voz, tamanho das mensagens, se assina o nome, atraso de digitação.
- **Base de conhecimento (ensinar)**: lista de instruções em linguagem natural ("se o cliente disser que está desempregado, faça X"), cada uma com liga/desliga. Também um campo livre de "instruções gerais".
- **Perguntas e respostas**: pares pergunta/resposta que ele deve usar sempre igual (ex.: onde pago, prazo do boleto, negativação).
- **Nunca fazer**: lista de assuntos proibidos → qualquer um deles cai direto em "Aguardando Humano".
- **Aprendizado**: mostra os padrões extraídos das negociações reais (o que funcionou, objeções comuns), com opção de desativar um aprendizado específico e botão para rodar a extração na hora.
- **Follow-up**: liga/desliga, intervalo (padrão 2h), janela 08h–19h, texto do toque de retomada.
- **Regras de escalada**: contatos de emergência e limite de mensagens por conversa/dia.
- **Testar**: campo para simular uma mensagem de cliente e ver a resposta que IAGO daria, sem enviar nada.

## Detalhes técnicos

Banco (nova migração):
- `iago_config`: uma linha — ativo, persona, tom, instruções gerais, delay de digitação, follow-up (ativo, horas, janela), limites, `user_id` do IAGO.
- `iago_conhecimento`: tipo (`instrucao` | `qa` | `proibido` | `aprendizado`), gatilho/pergunta, conteúdo, ativo, origem (`manual` | `auto`).
- `iago_conversa_estado`: por contato — etapa, cpf, `aguardando_humano`, `optout`, `followup_em`, `followup_feito`, contadores, ids das mensagens enviadas pela IA.
- Grants + RLS: leitura/escrita para admin, `service_role` liberado para as edge functions.
- Perfil do IAGO criado como usuário do sistema (via função admin existente), com etiqueta e entrada em `meta_atendimento_fila`; `meta_provisionar_atendentes_fila` continua garantindo a fila quando você marcar ele numa caixa.

Backend:
- Nova edge function `iago-atendimento`: recebe a mensagem de entrada, confere se a conversa está etiquetada como IAGO e a caixa tem ele como responsável, monta o contexto (débitos reais via `consultar_debitos_por_cpf`, `cpf_has_acordo`, `cpf_acordo_funcionario_nome`, grade 4x–24x com parcela ≥ R$ 100), junta persona + conhecimento + aprendizados e chama a Lovable AI para redigir a resposta no tom humano. Detecta opt-out antes de qualquer resposta. Quando a IA sinalizar que não sabe responder ou que o cliente quer fechar: etiqueta "Aguardando Humano", grava estado e avisa emergência via `notificar-admin`.
- `meta-whatsapp-webhook`: além do fluxo atual da caixa IA, dispara `iago-atendimento` (com `EdgeRuntime.waitUntil`) quando a conversa pertencer ao IAGO; envio humano na conversa desliga o IAGO ali.
- Nova function `iago-followup-tick`: cron de hora em hora entre 08h e 19h BRT — busca conversas com `followup_em` vencido, sem resposta do cliente, dentro da janela de 24h, sem opt-out, e envia o único toque de retomada.
- Nova function `iago-aprender`: cron 1x/dia — lê conversas de clientes com acordo lançado, resume os padrões via Lovable AI e grava em `iago_conhecimento` como `aprendizado` (origem `auto`).
- Envio pelo `send-whatsapp-meta-text` com a instância da própria conversa, marcando as mensagens como do IAGO para não serem lidas como "humano assumiu".

Frontend:
- Novo `src/components/admin/IagoConfigDialog.tsx` com as abas acima; botão "Configurar IAGO" no card do usuário em `AdminUsuarios.tsx` (só admin).
- `MetaFolderAcessoDialog.tsx`: IAGO aparece na lista de atendentes da caixa com selo "IA", podendo ser marcado/desmarcado como qualquer atendente.
- Indicador na lista de conversas quando o IAGO está conduzindo.

Custo: sem polling novo no cliente. Dois crons leves (follow-up horário na janela 08–19h e aprendizado diário) e chamadas de IA apenas em mensagem recebida, respeitando o limite por conversa/dia.
