# Envio de template Meta nos cards de Retornos

## Objetivo
Adicionar em cada card da aba **Retornos** o mesmo botão de WhatsApp usado em **Meus Acordos** e **Acordos da Equipe**, abrindo o seletor de templates da API Oficial Meta com o cliente já preenchido.

## Implementação
1. **Reutilizar o envio oficial existente**
   - Abrir o diálogo “Nova conversa Meta” ao clicar em **WhatsApp**.
   - Preencher automaticamente nome e telefone do retorno.
   - Manter seleção de template, favoritos, pré-visualização, variáveis obrigatórias e escolha de uma instância que tenha o modelo aprovado.
   - Registrar a conversa na caixa padrão, igual ao fluxo dos cards de acordos.

2. **Atualizar os cards de Retornos**
   - Exibir o botão em todos os cards, inclusive nos retornos sem dados financeiros e nos já concluídos.
   - Desabilitar a ação somente quando não houver telefone cadastrado.
   - Substituir o envio direto antigo, que hoje depende dos dados do acordo e usa uma mensagem pronta, pelo diálogo de template Meta.
   - Após um envio confirmado, fechar o diálogo e manter o indicador de mensagem enviada daquele retorno atualizado.

3. **Carregar somente números Meta disponíveis**
   - Usar a mesma consulta já utilizada nas duas páginas de acordos.
   - Informar claramente quando não existir nenhuma instância da API Oficial Meta disponível.
   - Preservar as permissões atuais da aba: cada usuário continua vendo e operando apenas os retornos aos quais já possui acesso.

## Detalhes técnicos
- Alterar somente a página de Retornos e reutilizar `MetaNovaConversaDialog` e a consulta `get_meta_whatsapp_active_instances_for_sending`.
- Remover da página os estados e a chamada UAZAPI exclusivos do envio direto antigo que deixarem de ser necessários.
- Não criar tabela, agendamento ou nova função; portanto, não há aumento recorrente de consultas ou custo.

## Validação
- Abrir o botão em retorno com e sem dados financeiros, confirmando nome e telefone preenchidos.
- Confirmar busca/favoritos, seleção de template, variáveis e escolha da instância compatível.
- Confirmar o envio e o registro visual como enviado.
- Verificar o botão desabilitado quando faltar telefone e a mensagem de indisponibilidade quando não houver número Meta apto.
- Testar a disposição dos botões em computador e celular sem afetar **Concluir** e **Excluir**.
