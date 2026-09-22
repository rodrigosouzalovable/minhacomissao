# Templates ativos e BMs aprovadas no Certificado Digital

## Objetivo

Na aba **Certificado Digital > Prospecção**, permitir controlar quais templates aparecem como habilitados para esse projeto e, ao escolher um deles, mostrar automaticamente apenas as BMs que possuem esse mesmo template e idioma aprovados.

## O que será criado

### 1. Gerenciamento local dos templates

- Adicionar uma área **Gerenciar templates** com a lista dos templates mestre.
- Cada template terá o estado **Habilitado** ou **Inabilitado**.
- O template inabilitado continuará visível, com aparência desativada, e poderá ser habilitado novamente pelo botão correspondente.
- Essa configuração será exclusiva do **Certificado Digital**: não mudará campanhas, injeção automática, templates mestre nem qualquer outra área do sistema.
- O campo **Template para envio** aceitará somente templates habilitados.
- Se o template atualmente selecionado for inabilitado, o piloto será pausado e exigirá uma nova seleção válida antes de voltar a enviar.

### 2. Verificação automática das BMs

Ao selecionar o template:

- Cruzar automaticamente **nome + idioma** com os templates sincronizados das instâncias Meta.
- Exibir somente BMs ativas que tenham pelo menos uma instância ativa com esse template em estado **approved**.
- Mostrar, para cada BM compatível, quantas instâncias possuem a aprovação e a data da sincronização mais recente.
- Limpar e pausar a BM anterior se ela não for compatível com o novo template.
- Permitir que o administrador escolha uma BM entre as opções aprovadas.
- Depois da escolha, manter a conferência atual por instância: somente números conectados, aptos, no pool e com o template aprovado poderão enviar.
- Quando nenhuma BM possuir aprovação, impedir a ativação do piloto e informar claramente que o template ainda não está disponível para envio.

A consulta automática usará os estados já sincronizados no sistema, sem consultar a Meta a cada clique. A tela exibirá a data da última sincronização e manterá uma ação manual para atualizar a situação quando necessário.

## Estrutura e segurança

- Criar uma configuração própria para templates do Certificado Digital, relacionando o template mestre ao estado habilitado/inabilitado.
- Aplicar acesso somente administrativo, isolamento, RLS e permissões de serviço.
- Criar índice para a busca por template, idioma e estado de aprovação, evitando consultas pesadas.
- O processador continuará validando novamente a aprovação por instância antes de qualquer envio; a seleção visual de uma BM não substituirá essa proteção.
- Não haverá rotação entre templates: permanece **um único template selecionado por vez** para o piloto.

## Validação

- Habilitar, inabilitar e reabilitar templates sem afetar outras áreas.
- Confirmar o aspecto visual inabilitado e sua exclusão do campo de envio.
- Selecionar templates com aprovações diferentes e conferir a mudança automática da lista de BMs.
- Confirmar a contagem das instâncias aprovadas por BM usando nome + idioma.
- Confirmar pausa segura quando o template ou a BM deixar de ser válido.
- Confirmar que o envio usa somente instâncias aprovadas, aptas e no pool.
- Validar a tela em computador e celular e conferir compilação e registros das funções.

## Custo e impacto

**Alerta de custo:** será adicionada uma pequena tabela de configuração e uma consulta indexada quando o template for escolhido. Não haverá novo cron, polling, canal em tempo real ou consulta automática à Meta por clique; portanto, o impacto recorrente esperado é mínimo.
