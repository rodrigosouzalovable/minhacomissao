# Templates do Thiago e observações por instância Meta

## Resultado esperado
- Thiago poderá enviar seus templates diretamente para aprovação da Meta nos seus próprios números, inclusive modelos com imagem, e acompanhar o resultado real por número. Isso **não inicia campanhas nem envia mensagens aos clientes**; o uso do template continua condicionado à aprovação da Meta.
- Na aba **API Oficial Meta**, cada instância terá um campo de **Observações** ao lado de Business Manager, com salvar, editar e apagar. O texto aparecerá também junto ao mesmo número na lista da aba **Envio Meta**.

## 1. Corrigir a submissão de templates
1. Ajustar o envio em lote, que atualmente remove todas as instâncias de parceiros antes de chamar a Meta. Aceitar somente as instâncias efetivamente vinculadas ao parceiro autenticado; administradores poderão operar as instâncias que lhes são permitidas. Validar essa autorização no serviço, inclusive ao reenviar falhas e ao escolher números, para impedir o acesso a contas de terceiros.
2. Não apresentar “envio iniciado” quando nenhum número foi aceito. Registrar e mostrar por instância se houve submissão, limite diário, falta de credenciais/App para imagem ou recusa da Meta, sem ignorar falhas de gravação. Preservar o limite de **2 templates por dia** nos números tier 250 e o envio direto em lote, sem piloto obrigatório.
3. Para templates com imagem, validar a associação entre número, conta Meta e App autorizado para upload; usar um App acessível ao token da instância, sem assumir que a BM padrão de outra empresa tem acesso. Se a Meta negar a permissão, mostrar o motivo e qual configuração precisa ser regularizada, sem afirmar aprovação.
4. Conferir os modelos recentes do Thiago, que estão salvos localmente mas não têm registros de submissão por instância; testar os caminhos de seleção, imagem, submissão e consulta de status **sem disparar lote real automaticamente**.

## 2. Observações nas instâncias
1. Adicionar um campo opcional de texto à própria instância, sem alterar os dados da Business Manager. O campo vazio representa ausência de observação.
2. Mostrar um editor discreto ao lado do seletor Business Manager em cada cartão da API Oficial Meta, com salvar/cancelar e ação de apagar confirmada. Restringir alterações a administradores e a parceiros autorizados naquela instância; outros usuários autorizados apenas a visualizar não poderão editar.
3. Exibir a observação salva abaixo do nome/BM do número na seleção de instâncias de Envio Meta, com texto legível em telas estreitas e atualização após recarregar a lista.

## Detalhes técnicos e validação
- Alterar `meta-criar-template-lote`, a apresentação de erros/status em `MetaTemplates.tsx`, e os cartões em `ConfigurarMeta.tsx` e `EnvioMeta.tsx`. Acrescentar coluna opcional em `meta_whatsapp_instances` via migração; usar as permissões existentes da instância, verificando o escopo no serviço de submissão.
- Conferir os resultados em desktop e celular e verificar que observações não afetam o envio. Não criar agendamentos, consultas periódicas ou novos disparos; a eventual aprovação final do template depende da Meta.
