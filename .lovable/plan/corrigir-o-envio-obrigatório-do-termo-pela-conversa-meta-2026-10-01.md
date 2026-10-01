# Corrigir o envio obrigatório do termo pela conversa Meta

## Resultado esperado
- O acordo de Rosilda/Rose Castro localizará automaticamente a conversa mais recente do telefone confirmado.
- O botão **Enviar no WhatsApp Oficial** aparecerá no diálogo obrigatório.
- Quando o mesmo telefone existir em mais de uma instância, a conversa mais recente ficará selecionada e o usuário poderá trocar a instância antes do envio.

## Implementação
1. Criar uma consulta protegida no backend que procure contatos pelo sufixo normalizado dos 8 últimos dígitos.
2. Retornar somente conversas que o usuário autenticado já pode acessar na caixa PADRÃO, preservando as permissões atuais.
3. Ordenar pelas mensagens mais recentes e selecionar automaticamente a primeira opção.
4. Trocar a busca direta do diálogo por essa consulta, incluindo nome do contato, instância, telefone e identificador Meta necessários ao envio.
5. Diferenciar “nenhuma conversa encontrada” de uma falha de consulta, exibindo uma mensagem clara em vez de esconder o erro.
6. Validar com o acordo pendente de Rosilda Castro e confirmar que a conversa mais recente `SOUZA 62 8269-8247` aparece pronta para envio, sem disparar mensagem real durante o teste.

## Detalhes técnicos
- A busca usará a função normalizadora e o índice por sufixo já existentes, sem nova rotina periódica ou aumento recorrente de custo.
- A consulta protegida aplicará `can_view_meta_contato_folder` e as permissões da Inbox antes de devolver cada conversa.
- O envio continuará usando a validação já existente para upload e envio de documento na conversa escolhida.
