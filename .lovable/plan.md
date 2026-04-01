

## Dividir Diálogos em sub-abas por tipo

### O que muda
Adicionar sub-abas (Tabs) dentro da aba Diálogos para filtrar por tipo: **Texto**, **Áudio**, **Imagem** e **Sticker**. Cada sub-aba mostra apenas os diálogos daquele tipo, com contagem no badge.

### Alterações em `src/components/aquecimento/AquecimentoDialogosTab.tsx`

1. Importar `Tabs, TabsList, TabsTrigger, TabsContent` do componente de tabs
2. Adicionar estado `activeType` (default: `'texto'`)
3. Abaixo do CardHeader, renderizar um `TabsList` com 4 triggers:
   - 📝 Texto (count)
   - 🎙️ Áudio (count)
   - 🖼️ Imagem (count)
   - 😄 Sticker (count)
4. Filtrar `dialogos` pelo tipo selecionado antes de renderizar a tabela
5. O botão "Adicionar Diálogo" pré-seleciona o tipo da aba ativa ao abrir o formulário
6. Remover a coluna "Tipo" da tabela (já é implícito pela aba selecionada)

