# Concluir retorno pelo aviso na tela

## O que muda

- Para retornos agendados pela conversa do Inbox, trocar o botão **“Entendido”** por **“Concluído”** no aviso que aparece no horário marcado.
- Ao clicar, marcar o retorno como concluído, fechar esse aviso e mostrar o próximo, se houver. O retorno concluído não voltará a aparecer, mesmo depois de recarregar a página.
- Se não for possível salvar a conclusão, manter o aviso aberto e mostrar o erro para permitir nova tentativa.
- Avisos de retornos sem conversa vinculada continuam com o comportamento atual.

## Detalhes técnicos

- Ajustar apenas `RetornoAlertChecker` para atualizar `retornos.status` para `concluido` no clique, restrito ao retorno pendente do usuário logado; desabilitar o botão enquanto salva e só retirar o item da fila após confirmação da gravação.
- A consulta existente já busca somente registros `pendente`; sem novo agendamento, consulta periódica ou mudança de estrutura de dados.
- Validar conclusão, falha de gravação e sequência de múltiplos avisos sem realizar envios a clientes.
