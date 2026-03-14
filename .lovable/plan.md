

# Botão para abrir Dialog completo dos Lembretes

## O que será feito

Adicionar um ícone (botão `Expand`/`Maximize`) no canto superior direito do popover de lembretes. Ao clicar, fecha o popover e abre um `Dialog` em tela maior contendo **todas** as informações das abas Pendentes e Histórico — mesma estrutura visual, mas em formato expandido com mais espaço.

## Mudanças

### `src/components/PaymentReminders.tsx`

1. Importar `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` e ícone `Maximize2`
2. Adicionar estado `dialogOpen`
3. No `PopoverContent`, adicionar um botão com ícone `Maximize2` no canto superior direito (antes das tabs)
4. Ao clicar, setar `dialogOpen = true` (o popover fecha automaticamente)
5. Renderizar um `Dialog` com o conteúdo completo:
   - Mesmas 3 seções (Vencidas, Hoje, D-3) com os mesmos `renderLembreteItem`
   - Aba Histórico com `renderHistoricoItem`
   - Usar `max-h-[70vh]` para scroll confortável
   - Tabs idênticas dentro do dialog

Nenhum arquivo novo. Apenas edição do `PaymentReminders.tsx`.

