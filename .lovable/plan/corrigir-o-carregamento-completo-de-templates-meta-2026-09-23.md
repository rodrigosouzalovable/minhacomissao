# Corrigir o carregamento completo de templates Meta

## Objetivo
Garantir que todos os templates disponíveis para envio sejam carregados nos campos de seleção, incluindo o **receber_boleto**.

## Situação confirmada
- Existem **1.540 registros de templates sincronizados** no sistema.
- Os campos atuais recebem no máximo os primeiros **1.000 registros** por consulta.
- O template **receber_boleto** está aprovado, na categoria Utilidade, em **5 instâncias**, mas fica depois desse corte e por isso não aparece.

## Alterações
1. Criar um carregamento paginado e reutilizável que busque todos os registros de templates, em blocos seguros, até o fim da lista.
2. Aplicar esse carregamento no botão **Nova Conversa Meta** e na aba **Envio Meta**.
3. Aplicar a mesma correção nos demais campos operacionais que escolhem templates para envio, evitando que o problema reapareça em outra tela.
4. Manter as regras existentes: um template só poderá ser enviado por uma instância onde esteja aprovado; filtros de categoria e permissões continuarão valendo.
5. Preservar pesquisa, favoritos, conteúdo da mensagem, variáveis e pré-visualização já existentes.

## Validação
- Confirmar que **receber_boleto** aparece na pesquisa da Nova Conversa Meta.
- Confirmar que ele aparece no Envio Meta quando uma das 5 instâncias aprovadas estiver selecionada.
- Verificar listas com mais de 1.000 registros, favoritos no topo e ausência de duplicidades.
- Testar seleção, preenchimento de variáveis, pré-visualização e envio sem alterar as regras de aprovação.

## Detalhes técnicos
A consulta será paginada no cliente em lotes de até 1.000 registros, preservando o isolamento e as permissões atuais. Nenhuma nova rotina automática, consulta periódica ou custo recorrente será criado.
