# Selecionar o template antes das instâncias no Envio Meta

## Resultado esperado
O campo **Templates HSM** mostra todos os seus modelos de **Utilidade** cadastrados, mesmo sem nenhuma instância selecionada. Você escolhe primeiro o template, depois as instâncias, e pode aplicar o modelo somente onde ele estiver faltando.

## Situação verificada
- A lista ainda depende das instâncias selecionadas e fica vazia quando nenhuma é escolhida.
- A orientação atual pede escolher as instâncias primeiro, apesar de o template aparecer como etapa 1.
- Existe uma ação de aplicação para instâncias sem aprovação, mas o catálogo atual impede escolher modelos ausentes em todas elas.

## Alterações
1. **Catálogo independente:** carregar todos os modelos Utility do seu usuário, de forma paginada, e reunir as cópias sincronizadas autorizadas sem duplicar nome e idioma. Não incluir Marketing nem modelos de outro proprietário no catálogo próprio.
2. **Template primeiro:** permitir selecionar e visualizar a mensagem antes de escolher qualquer instância. Manter pesquisa, favoritos, idioma, texto, cabeçalhos, botões e variáveis. Sem instâncias selecionadas, mostrar uma indicação neutra em vez de aprovação 0/0.
3. **Seleção estável:** escolher, adicionar ou remover instâncias não apaga o template escolhido. A disponibilidade é recalculada apenas para as instâncias selecionadas.
4. **Aplicação dos faltantes:** mostrar por instância se o modelo está aprovado, em análise, na fila, rejeitado ou ausente. Oferecer **Aplicar nas instâncias selecionadas**, somente para os destinos elegíveis onde falta o modelo, sem repetir submissões existentes ou em análise.
5. **Retorno e atualização:** mostrar o resultado por instância, incluindo motivos de espera ou bloqueio, e permitir atualizar manualmente sem sair da página. Um modelo sincronizado sem cadastro mestre próprio recebe uma orientação, não uma aplicação inventada.
6. **Envio protegido:** liberar a campanha somente quando todas as instâncias selecionadas tiverem cópias aprovadas do template e de eventuais variações. Permitir retirar as incompatíveis.

## Regras preservadas
- Aplicação continua sujeita às permissões existentes e ao mesmo proprietário do modelo e da instância.
- Aplicar coloca na fila; não significa aprovação imediata pela Meta.
- GREEN e UNKNOWN com leitura válida e sem bloqueio real podem seguir; YELLOW/RED aguardam.
- Tier 250 mantém até dois templates por número/dia; tiers superiores mantêm aplicação sequencial.
- Sem novo agendamento, polling ou rotina recorrente.

## Detalhes técnicos
- Separar o catálogo de prévia dos registros aprovados usados no envio; modelos mestre sem cópia não recebem identificadores fictícios de envio.
- Reutilizar o seletor com favoritos e a fila existente, corrigindo a deduplicação no caminho de aplicação específica e preservando autorização no servidor.
- Consultas paginadas e restritas ao usuário ao carregar ou atualizar manualmente; tratar falhas com aviso recuperável.

## Validação
- Testar modelo próprio ausente em todas as instâncias, visível e selecionável antes da escolha delas.
- Testar contagens exatas, manutenção da seleção, isolamento por proprietário e exclusão de Marketing.
- Testar deduplicação de modelos existentes, em análise e na fila.
- Conferir pesquisa, favoritos, prévia, variáveis e link dinâmico, sem enviar mensagens nem submeter templates reais.