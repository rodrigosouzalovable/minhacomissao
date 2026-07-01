## Objetivo
Limpar o topo do sidebar do Inbox Meta Oficial, removendo o botão redundante "Nova" e mantendo apenas o acesso a mensagens rápidas, com layout mais organizado e visualmente limpo.

## Contexto atual
O topo do sidebar possui 3 botões em linha:
- **"Nova"** → abre diálogo de nova conversa (`MetaNovaConversaDialog`)
- **"+"** → abre mensagens rápidas (`MetaMensagensRapidasDialog`)  
- **Ícone de etiqueta** → abre gerenciamento de etiquetas (`MetaEtiquetasDialog`)

O usuário deseja remover o botão "Nova" e manter apenas o de mensagens rápidas, deixando o visual mais limpo.

## Alterações

### 1. Remover botão "Nova" do topo do sidebar
- Em `src/pages/InboxMeta.tsx`, remover o `<Button>` com ícone `MessageSquarePlus` e label "Nova" (linhas ~483-485).
- Remover import não utilizado `MessageSquarePlus` se não for usado em outro lugar da página.

### 2. Reorganizar botões restantes
- Manter o botão de mensagens rápidas (agora como botão principal do topo).
- Reconsiderar posicionamento do botão de etiquetas: movê-lo para área de filtros/busca ou mantê-lo como ícone compacto ao lado da busca, deixando o topo com menos elementos.
- Ajustar layout da primeira linha do sidebar: título + badge + botão de mensagens rápidas, eliminando a segunda linha de botões quando possível.

### 3. Ajustar imports e estados
- Verificar se `novaOpen` e `setNovaOpen` ainda são necessários em outras partes da página; se não, remover estado e import do `MetaNovaConversaDialog`.
- Se o diálogo de nova conversa for removido do sidebar, verificar se ele é acionado de outro lugar (ex: atalho de teclado, outro botão) antes de eliminar completamente.

## Escopo limitado
- Apenas reorganização visual do topo do sidebar em `src/pages/InboxMeta.tsx`.
- Nenhuma alteração em lógica de backend, rotas ou outros componentes.
- Preservar todas as funcionalidades existentes (mensagens rápidas, etiquetas, filtros, busca, abas).