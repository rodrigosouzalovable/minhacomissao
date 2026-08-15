Ajustar filtro de BMs na aba "Instâncias" de ConfigurarMeta

Objetivo
--------
Remover a sub-aba "BMs" da tela API Oficial Meta e transformá-la em um botão de filtro **dentro** da aba "Instâncias", ao lado do botão "Verificar saúde dos webhooks", com o mesmo comportamento da aba "Instâncias" da tela Envio Meta.

O que será feito
----------------
1. Remover o item "BMs" do `TabsList` e apagar todo o `TabsContent value="bms"`.
2. Adicionar um `DropdownMenu` no cabeçalho da aba "Instâncias", posicionado entre "Verificar saúde dos webhooks" e "Nova instância".
3. O botão deve mostrar:
   - Ícone `Building2` + texto "BMs" quando nenhuma BM estiver selecionada.
   - "BMs (N)" quando N BMs estiverem selecionadas.
4. O dropdown deve conter:
   - Checkbox para cada BM conectada, mostrando nome e quantidade de instâncias vinculadas.
   - Checkbox "Sem BM vinculada".
   - Item "Selecionar todas" / "Desmarcar todas".
   - Item "Limpar filtro".
5. Reaproveitar a lógica existente (`bmSel` como `Set<string>` e `toggleBmSel`) para filtrar `instanciasFiltradas` já usada no map da aba "Instâncias".
6. Manter os chips de filtro já existentes na parte esquerda do cabeçalho, que indicam quais BMs estão selecionadas.
7. Ajustar imports: remover `Popover`, `PopoverContent`, `PopoverTrigger`, `Checkbox` e `ScrollArea` que deixam de ser usados; adicionar `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuCheckboxItem` e `DropdownMenuItem`.

Resultado esperado
------------------
- A aba "Instâncias" ganha um botão "BMs" ao lado de "Verificar saúde dos webhooks".
- Ao clicar, abre-se um dropdown flutuante para seleção múltipla.
- A lista de instâncias abaixo é filtrada automaticamente pelas BMs escolhidas.
- A sub-aba "BMs" some completamente.
