# Plano — “Não é o cliente” e blacklist no Inbox Meta

## Resultado esperado
- Adicionar **“Não é o cliente”** ao menu aberto com o botão direito em cada conversa.
- Ao confirmar, gravar o telefone diretamente na **blacklist existente**, com nome, caixa, instância, usuário e data da marcação.
- Impedir duplicidade pelo sufixo do telefone, atualizando os dados da marcação quando o número já estiver bloqueado.
- Manter a conversa disponível no Inbox; a ação não arquivará nem apagará mensagens.

## Lista administrativa
- Remover do cabeçalho do Inbox a função **“Conversas por atendente”**.
- Colocar no mesmo local um botão de **“Não é o cliente”**, visível somente para administradores.
- Abrir uma janela com busca, total, telefone, nome, caixa, usuário que marcou e data.
- Incluir no topo o botão **Baixar Excel**, exportando todos os telefones marcados para uso no Cobmais.
- Permitir ao administrador **desfazer** uma marcação; o número sairá da blacklist e voltará a poder receber campanhas.

## Proteção dos envios
- Reutilizar a checagem já existente no Envio Meta, que compara os últimos 8 dígitos e retira destinatários da blacklist antes de criar o disparo.
- Garantir que registros com motivo “Não é o cliente” sejam sempre reconhecidos nessa checagem e apareçam no resumo de números removidos.
- Não alterar as demais regras de supressão, repetição ou campanhas.

## Segurança e validação
- Criar uma função autenticada para registrar a marcação: o servidor buscará o telefone e os dados da conversa, evitando dados falsos enviados pela tela.
- Qualquer usuário com acesso à conversa poderá marcar; somente administradores poderão consultar a lista completa, exportar e desfazer.
- Validar no navegador: marcar uma conversa, confirmar presença na lista, baixar o Excel, desfazer e confirmar que o número foi removido.
- Validar também que uma planilha do Envio Meta contendo o telefone marcado o exclui antes do envio, sem disparar mensagem real durante o teste.

## Impacto de custo
- **Baixo e sob demanda:** será reutilizada a tabela de blacklist atual, sem nova rotina automática, consulta periódica ou canal em tempo real.
- A lista será carregada apenas quando um administrador abrir a janela; o bloqueio usa a consulta já executada no início do Envio Meta.
