# Registrar respostas automáticas de todas as conversas

## Objetivo
Sempre que uma pessoa responder automaticamente a uma mensagem enviada pelo sistema, guardar seu número na lista **Contatos com resposta automática** mostrada na imagem, independentemente de a mensagem ter vindo de campanha, atendimento ou aquecimento.

## Situação confirmada
- A lista já existe e tem **649 contatos**, dos quais **141** foram detectados nos últimos sete dias.
- Atualmente o registro nessa lista ocorre no recebimento de respostas vinculadas ao log de aquecimento Meta; outras conversas recebidas pela Meta e pela UAZAPI não seguem, em geral, esse mesmo registro.
- Nos últimos sete dias houve **362 mensagens recebidas pela Meta com possíveis sinais textuais de automação**; **332** têm envio anterior correspondente na mesma instância e **119** já têm número na lista. São candidatas, não 213 contatos confirmados: é preciso aplicar o detector completo e deduplicar antes de afirmar o resultado. Na UAZAPI, **35** mensagens têm sinais semelhantes e **5** têm envio anterior correspondente nesse recorte.

## O que será feito
1. **Ampliar a detecção:** aplicar o classificador já usado no aquecimento às novas mensagens recebidas pelas caixas Meta e UAZAPI, somente após identificar um envio anterior real ao mesmo contato na mesma instância. Tempo de resposta rápido, sozinho, não confirma automação; mensagens nossas, grupos, status, respostas humanas curtas e contatos sem envio anterior ficam fora.
2. **Guardar na lista existente:** inserir ou atualizar um registro por telefone, com última resposta, data, confiança e nome quando disponível. Contar cada mensagem recebida uma vez, mesmo com entregas duplicadas do webhook ou reprocessamento. Preservar as classificações e os registros já existentes; quando houver dados de empresa/nicho/cidade, aproveitá-los sem apagar dados úteis.
3. **Revisar os últimos sete dias:** varrer uma única vez, em lotes limitados, as conversas Meta e UAZAPI persistidas, vincular cada resposta a um envio anterior e classificar o texto pelo mesmo critério. Registrar somente os contatos confirmados que faltarem; atualizar ocorrências sem duplicar eventos já registrados. Não enviar nenhuma mensagem durante essa revisão.
4. **Conferir o resultado:** verificar a contagem antes/depois, amostras de mensagens automáticas e humanas, números já cadastrados, recebimentos duplicados e a lista na tela. Apresentar quantos contatos novos foram efetivamente encontrados; se não houver confirmação suficiente, informar isso sem preencher com suspeitas.

## Segurança e custo
- A lista continua restrita aos administradores. A revisão histórica será pontual e paginada; novas respostas usam o fluxo de recebimento existente, sem criar agendamentos, polling ou disparos.
- **⚠️ Alerta de custo Lovable Cloud:** a ampliação gera uma consulta curta a envios anteriores para cada nova mensagem recebida e uma gravação apenas para respostas automáticas confirmadas. A revisão dos últimos sete dias gera leituras e gravações pontuais. Hoje foram observadas cerca de **12,9 mil mensagens recebidas nos últimos sete dias** nas duas caixas; o impacto pode ser perceptível se a checagem for feita sem índice. Antes de ativar, usar índices adequados, restringir a busca por instância/telefone/data e processar o histórico em lotes. A aprovação deste plano autoriza esse aumento controlado.

## Detalhes técnicos
- Reutilizar `classificarRespostaAutomatica` e a tabela `meta_aquecimento_auto_respondedores`; separar o registro genérico da atualização específica do log e dos leads Google Maps para não atribuir respostas de outras campanhas ao aquecimento.
- Garantir idempotência pelo identificador da mensagem recebida (ou identificador persistido equivalente), com vínculo por instância e sufixo de oito dígitos e preservação do número completo/DDI para exibição e identidade quando disponível.
- Integrar a gravação após persistência bem-sucedida nos fluxos reais de entrada da Meta e da UAZAPI; para o histórico, reutilizar o mesmo critério sem novo cron nem reativação do Google Maps.
