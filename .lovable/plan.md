# Campanha diária do Certificado Digital e atendimento da Clara

## Objetivo

Transformar a prospecção do Certificado Digital em um fluxo acompanhável: iniciar manualmente pela própria aba ou automaticamente às **09:00 BRT, de segunda a sexta**, enviar até o limite diário já configurado com intervalos aleatórios de **30 a 90 segundos**, mostrar a campanha no painel flutuante e concentrar as conversas na caixa **CERTIFICADO**. A Clara atenderá exclusivamente essa caixa e entregará ao humano quando reunir a documentação necessária.

## Processamento e envio

1. Substituir o processamento direto atual por uma campanha persistente usando a fila de campanhas já existente.
2. Adicionar na aba **Certificado Digital > Prospecção** o botão **Iniciar processamento e envios**:
   - coleta os leads das janelas configuradas;
   - verifica imediatamente quais números possuem WhatsApp usando somente as UAZAPIs selecionadas;
   - cria a campanha do dia com os contatos confirmados e ainda não utilizados;
   - inicia o envio imediatamente quando estiver em dia útil e dentro da janela permitida;
   - impede campanha duplicada do Certificado Digital no mesmo dia.
3. Separar coleta e disparo automáticos:
   - manter a coleta existente sem criar uma segunda coleta;
   - iniciar a campanha automaticamente às **09:00 BRT, segunda a sexta**;
   - retirar o disparo acoplado ao horário antigo da coleta para evitar execução duplicada;
   - sábado e domingo não iniciam campanha automática nem manual.
4. Manter o teto agregado atual de **50 mensagens por dia** para a BM piloto, descontando o que já tiver sido enviado no dia.
5. Usar somente instâncias da BM selecionada que estejam conectadas, disponíveis, no pool e com o template aprovado, preservando todas as travas reais da Meta.
6. Distribuir os envios em round-robin e programar cada próximo item com atraso realmente aleatório entre **30 e 90 segundos**, sem deixar uma função aberta esperando.
7. Se faltarem leads, template aprovado ou instância apta, registrar o motivo e não criar disparos inválidos.

## Campanha e acompanhamento

- Criar uma campanha diária com nome como **Certificado Digital — 22/09/2026**.
- Exibi-la automaticamente no botão flutuante **Campanhas**, com status, progresso, próximo envio, enviados e erros.
- Exibi-la também no histórico da aba **Campanhas**, associada à caixa CERTIFICADO e às instâncias participantes.
- Atualizar entrega, leitura, resposta e falha pelos retornos oficiais da Meta.
- Marcar a campanha como **Concluída** quando atingir o limite disponível do dia ou quando não restarem contatos elegíveis.
- Permitir pausa, retomada e cancelamento pelos controles de campanha já existentes.

## Caixa CERTIFICADO

- Usar a caixa já criada **CERTIFICADO** em todos os envios deste piloto.
- Ao criar ou atualizar o contato, gravar a conversa nessa caixa sem alterar a pasta padrão global da instância, evitando afetar outras campanhas da mesma BM.
- Preservar a caixa quando a resposta chegar pelo webhook, inclusive quando o telefone variar em DDI/formatação, usando o padrão dos últimos 8 dígitos.
- Vincular a mensagem enviada, seus estados e a resposta ao item correspondente da campanha do Certificado Digital.

## Clara — atendimento exclusivo da caixa CERTIFICADO

1. Vincular a usuária existente **Clara Ribeiro de Souza** à caixa CERTIFICADO e criar/usar a etiqueta **Atendente: Clara Ribeiro de Souza**.
2. Criar um fluxo próprio da Clara, separado das regras de cobrança do IAGO, acionado somente para contatos desta caixa e atribuídos a ela.
3. Quando o cliente demonstrar interesse, a Clara envia:
   - **“Para emissão do certificado digital é necessário agendar com você uma videoconferência hoje que leva apenas 3 minutos. Podemos realizar o agendamento?”**
4. Quando o cliente aceitar, a Clara envia:
   - **“Para que possamos realizar o agendamento da videoconferência para emissão do seu certificado digital é necessário que nos encaminhe o seu CNPJ seu e-mail e uma CNH que pode ser física ou digital. Consegue nos enviar por gentileza?”**
5. Registrar separadamente o recebimento de CNPJ, e-mail e CNH, aceitando os dados em mensagens diferentes e reconhecendo CNH enviada como imagem ou documento.
6. Quando os três itens forem recebidos, confirmar o recebimento, marcar **Aguardando Humano** e encerrar as respostas automáticas da Clara nessa conversa.
7. Se um atendente humano escrever, a Clara para imediatamente. Pedido de bloqueio/descadastro entra na blacklist e encerra o atendimento.
8. Dúvidas fora do fluxo, conteúdo ilegível ou situação que a Clara não possa confirmar são encaminhados ao humano; ela não inventa preço, prazo ou informação documental.

## Alterações técnicas

- Ajustar o orquestrador do Certificado Digital para criar `envio_meta_job` e seus itens, reutilizando o worker seguro já existente.
- Persistir a referência do lead do Certificado Digital no item da campanha para atualizar seu status sem duplicidade.
- Criar configuração/estado próprios da Clara e políticas de acesso administrativo, com grants e RLS.
- Integrar o webhook da Meta à Clara somente quando `folder_id` for o da caixa CERTIFICADO.
- Atualizar o webhook para refletir entrega, leitura e resposta tanto na campanha quanto nos registros do piloto.
- Criar o agendamento das 09:00 BRT em dias úteis e manter o processamento manual autenticado e restrito ao administrador.

## Validação

- Testar o botão com campanha nova, campanha já existente no dia e ausência de contatos elegíveis.
- Confirmar que 50 é o teto diário total e que cada intervalo fica entre 30 e 90 segundos.
- Confirmar bloqueio aos sábados e domingos e início automático às 09:00 BRT em dias úteis.
- Confirmar a campanha no painel flutuante e no histórico, com contadores e estados atualizados.
- Confirmar que envio e resposta aparecem somente na caixa CERTIFICADO, sem mudar outras conversas da instância.
- Testar o roteiro da Clara: interesse, aceite, coleta de CNPJ/e-mail/CNH, entrega ao humano, opt-out e interrupção por atendente humano.
- Validar compilação, funções publicadas, permissões e o fluxo real no desktop e celular.

## Custo e segurança

**Custo autorizado:** haverá uma nova rotina curta para iniciar/processar a fila às 09:00 em dias úteis, além das consultas da Casa dos Dados, verificações UAZAPI, mensagens de template da Meta e chamadas da Clara quando clientes responderem. O impacto de infraestrutura será mantido baixo reutilizando a fila, o worker e o acompanhamento existentes, sem novo polling ou canal em tempo real. O limite permanece em 50 mensagens por dia.
