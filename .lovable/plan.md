# Templates aprovados e compartilhamento de campanhas

## 1. Templates HSM: aprovação por instância

- Substituir a indicação de instâncias selecionadas ao lado do template por **“X instâncias com este template aprovado”**.
- Contar instâncias distintas às quais o usuário tem acesso, independentemente da seleção atual. Contar somente cópias Utility com aprovação registrada, sem incluir modelos em análise, na fila ou rejeitados.
- Ao selecionar o template, oferecer **“Ver instâncias aprovadas”**, com lista pesquisável de nomes e números e indicação das que já estão selecionadas.
- Manter separada a conferência da seleção atual: quantas selecionadas têm aprovação e quais precisam receber o template. Não selecionar instâncias automaticamente nem mudar as regras de aplicação/envio.
- Sem aprovações, mostrar **“Nenhuma instância com este template aprovado”**.

## 2. Compartilhar uma campanha para visualização

- No topo do diálogo da campanha, incluir **“Compartilhar visualização”**, com seleção pesquisável de um usuário cadastrado.
- Permitir ao responsável adicionar ou remover o acesso. O compartilhamento vale apenas para essa campanha, não para todas as campanhas do responsável.
- O usuário escolhido passa a ter o botão **Campanhas** no canto inferior direito e pode abrir a campanha compartilhada, inclusive depois de concluída.
- Mostrar andamento, resultados, custos, destinatários e detalhes da campanha, com indicação **“Somente visualização”**.
- Não permitir pausar, retomar, cancelar, excluir, repetir envios, alterar ritmo, adicionar/reativar instâncias ou compartilhar novamente.
- Não conceder acesso à tela Envio Meta, a outras campanhas, ao Inbox, às credenciais ou à administração de instâncias/templates.
- Ao remover o compartilhamento, bloquear novamente o acesso; o botão desaparece se não houver outra campanha compartilhada nem permissão própria para Campanhas.

## O que foi conferido

- O catálogo atual conta aprovações apenas entre as instâncias selecionadas; será necessário separar esse número do total aprovado nas instâncias acessíveis.
- A lista de campanhas é atualmente filtrada pelo proprietário, e o botão também depende da permissão existente.
- As regras de leitura e as funções de resultados consultadas exigem o proprietário. O compartilhamento precisa de autorização no servidor, não apenas de um botão na tela.

## Detalhes técnicos

- Ajustar o catálogo Utility e sua apresentação em Envio Meta, preservando escopo autorizado, agrupamento por nome/idioma e deduplicação por instância.
- Criar vínculo indexado por campanha/usuário, com concessões explícitas, RLS e gerenciamento restrito ao proprietário autenticado.
- Ampliar somente a leitura autorizada de campanhas, itens e resultados. Preservar as regras de escrita e validar as ações de controle também no servidor.
- Adaptar o contexto, botão flutuante, diálogo e painel de instâncias para distinguir proprietário de observador. Expor apenas os dados de instâncias necessários à campanha, sem liberar consultas gerais nem credenciais.
- Ajustar as funções de resumo/resultados para aceitar observadores autorizados; o cálculo permanece referente à campanha original.
- Usar consultas paginadas e atualização ao abrir o painel/diálogo ou clicar em Atualizar para campanhas compartilhadas. Não adicionar polling, agendamento ou canal Realtime.

## Validação

- Testar contagem com nenhuma seleção, seleção parcial, cópias duplicadas, aprovação pendente e instâncias sem acesso.
- Testar que o usuário escolhido lê apenas a campanha concedida; um terceiro continua sem acesso.
- Testar que ações de alteração são negadas ao observador, inclusive por chamada direta, e que a revogação bloqueia novas consultas.
- Conferir o botão Campanhas, a seleção de usuário e os detalhes usando contas distintas, sem enviar mensagens reais.

**Escopo:** as duas mudanças solicitadas, com compartilhamento somente para visualização, conforme sua escolha.