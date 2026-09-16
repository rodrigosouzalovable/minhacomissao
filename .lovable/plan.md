# Ações rápidas na lista de Google Maps Leads

## O que será alterado

- Adicionar um botão de copiar ao lado do telefone de cada empresa.
- A cópia terá somente **DDD + número**, removendo o DDI `55` quando ele estiver presente.
- Substituir o atual botão de ligação por um botão para copiar esta abertura, preenchendo automaticamente o nome da empresa:

> Olá, bom dia! Meu nome é Fernanda. Eu estava pesquisando empresas da sua região e encontrei a [nome da empresa]. Falo com a responsável?

- Remover o botão que abre o WhatsApp.
- No lugar dele, adicionar um botão com ícone de check verde para marcar que o lead demonstrou interesse em ver o site.
- Ao clicar no check, abrir uma confirmação com o nome da empresa e as opções **Cancelar** e **Confirmar interesse**.
- Somente após confirmar, registrar o lead como **Interessado** e **Contatado**, atualizar os contadores/filtros existentes e exibir uma confirmação de sucesso.
- Enquanto o registro estiver sendo salvo, bloquear uma segunda confirmação para evitar cliques duplicados.

## Comportamento visual

- Os botões serão compactos, alinhados com o telefone e com dicas ao passar o mouse: **Copiar telefone**, **Copiar script** e **Marcar como interessado**.
- Leads já marcados como interessados mostrarão o check como estado confirmado, sem pedir uma nova confirmação desnecessária.
- O layout continuará funcionando em computador e celular, mantendo a tabela rolável quando necessário.

## Detalhes técnicos

- Alteração concentrada na lista dos colaboradores em `MinhaProspeccaoLeads.tsx`.
- Reutilizar o resultado já existente `interessado` e a função segura já usada para atualizar somente os leads atribuídos ao usuário.
- Não será criada nova tabela, nova consulta periódica ou consumo adicional da API do Google Maps.
- Validar cópia com telefone contendo e sem DDI, substituição do nome no script, confirmação/cancelamento do interesse e atualização da lista.
