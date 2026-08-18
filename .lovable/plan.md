# UAZAPI: número no card, captura automática e busca

## 1. Mostrar o número em cada card

No card de cada instância, abaixo do nome, o número cadastrado aparece formatado (ex. `(62) 99167-2674`) ao lado da URL do servidor. Quando não houver número salvo, aparece um aviso discreto "Número não cadastrado".

## 2. Puxar o número automaticamente ao conectar

Ao conectar uma instância nova (QR Code ou código de pareamento), o status da UAZAPI já devolve o número do WhatsApp conectado. Esse número passa a ser gravado automaticamente no campo Telefone da instância, sem preenchimento manual.

Complementos:
- O botão "Verificar conexões" (já existente) também preenche o telefone das instâncias que estiverem sem número, aproveitando a resposta da checagem — sem chamadas extras.
- Nada é sobrescrito: se a instância já tem número salvo, ele é mantido.

## 3. Campo de busca na tela principal

Acima da lista de instâncias, um campo "Pesquisar número ou nome" filtra os cards em tempo real. A busca ignora formatação (parênteses, espaços, traços, DDI 55), então digitar `98218-3144`, `62982183144` ou parte do nome encontra o card. Um contador mostra quantos resultados foram achados e há botão para limpar.

Observações: com filtro ativo, o arraste de reordenação fica desabilitado (evita reordenar a lista errada) e a exportação em Excel continua exportando todos os números, não apenas os filtrados.

## Detalhes técnicos

- Arquivo único: `src/pages/Acionamento.tsx`.
- Card: novo trecho de exibição do telefone usando um helper local de formatação (dígitos → `(DD) 9NNNN-NNNN`), sem alterar layout dos badges.
- Captura automática: em `startQrPolling`, quando `data.connected` for verdadeiro e `data.phone` existir, gravar `telefone` na linha de `user_whatsapp_instances` antes de recarregar a lista; o `select` de refresh passa a incluir `telefone` (hoje ele não traz, o que zera o campo em memória).
- `checkInstanceConnections`: usar o `phone` já retornado por `checkUazapiConnection` para atualizar `telefone` apenas das instâncias com o campo vazio (um update por instância afetada, uma vez).
- Busca: estado `filtroInstancia` + `useMemo` derivando `instancesFiltradas`, usada na renderização da lista; `DndContext` recebe a lista completa e o arraste é ignorado quando há filtro.
- Sem migração de banco (coluna `telefone` já existe), sem novas edge functions, sem cron/polling adicional — nenhum impacto de custo no Lovable Cloud.
