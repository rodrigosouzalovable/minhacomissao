# Ações rápidas e central de leads interessados

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

## Central exclusiva do administrador

- Adicionar na aba Google Maps Leads um painel **Leads interessados**, visível somente ao administrador.
- Cada registro mostrará quem marcou o interesse, qual empresa demonstrou interesse, data/hora e os dados já salvos: telefone, endereço, categoria, site/rede social, nota, avaliações, WhatsApp e Instagram quando disponíveis.
- Destacar novos interessados e permitir abrir os detalhes completos da empresa.
- Incluir acesso direto ao perfil original da empresa no Google Maps para conferir os dados e obter as fotos manualmente.
- Reaproveitar o gerador existente de prompt e esboço, criando um prompt profissional personalizado com os dados reais do lead e análise de nicho já salva.
- Permitir copiar e baixar o prompt. As fotos não serão consultadas, copiadas ou armazenadas pelo sistema, conforme decidido, evitando consumo adicional da API.

## Comportamento visual

- Os botões serão compactos, alinhados com o telefone e com dicas ao passar o mouse: **Copiar telefone**, **Copiar script** e **Marcar como interessado**.
- Leads já marcados como interessados mostrarão o check como estado confirmado, sem pedir uma nova confirmação desnecessária.
- O layout continuará funcionando em computador e celular, mantendo a tabela rolável quando necessário.
- No painel administrativo, cada interessado terá ações claras para **Ver detalhes**, **Abrir Google Maps** e **Criar site**.

## Detalhes técnicos

- Alterar a lista dos colaboradores e a aba administrativa Google Maps Leads.
- Reutilizar o resultado já existente `interessado` e a função segura já usada para atualizar somente os leads atribuídos ao usuário.
- Criar uma consulta administrativa protegida que una atribuição, colaborador e lead, sem expor a lista aos demais usuários.
- Reutilizar os dados e o gerador de prompt existentes; não haverá nova tabela pesada, consulta periódica ou consumo adicional da API do Google Maps.
- Validar cópia com telefone contendo e sem DDI, substituição do nome no script, confirmação/cancelamento, atualização da central administrativa, acesso restrito e geração do prompt.
