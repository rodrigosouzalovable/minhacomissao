## Objetivo

Na aba **Envio Meta Massa**, o dropdown de templates deve refletir as instâncias selecionadas: mostrar apenas os templates aprovados e habilitados para massa que existem nas instâncias marcadas. Sem instância selecionada, o dropdown fica vazio com um aviso pedindo para selecionar ao menos uma instância.

## Comportamento

- 0 instâncias selecionadas → dropdown vazio + hint "Selecione uma ou mais instâncias para ver os templates disponíveis".
- 1 instância selecionada → aparecem só os templates aprovados+massa daquela instância.
- N instâncias selecionadas → união (todos os templates que existem em qualquer uma das selecionadas), com badge indicando "Disponível em X/N instâncias".
- Se o template selecionado deixar de estar disponível em nenhuma das instâncias atuais, o `templateId` é limpo.
- A validação atual de "instâncias incompatíveis" (aviso amarelo + botão Sincronizar) continua funcionando — ela agora só aparece quando o usuário escolhe um template presente em algumas mas não todas as instâncias selecionadas.

## Alterações técnicas

Arquivo único: `src/pages/EnvioMeta.tsx`

1. No `useMemo` de `templateGroups` (linha 316), filtrar `templates` por `instanciaIds` antes de agrupar:
   ```ts
   const templatesFiltrados = instanciaIds.length === 0
     ? []
     : templates.filter(t => instanciaIds.includes(t.instancia_id));
   ```
   Agrupa a partir desse array.

2. Adicionar `useEffect` que, quando `templateGroups` muda, verifica se `templateId` ainda existe; se não, faz `setTemplateId("")`.

3. Atualizar o texto vazio (linha ~505-508):
   - Se `instanciaIds.length === 0`: "Selecione uma ou mais instâncias acima para ver os templates disponíveis."
   - Se selecionou instâncias mas não há templates: mensagem atual sobre marcar "Massa" na aba API Oficial Meta.

4. No item do `SelectItem` (linha ~513), acrescentar um contador tipo `g.instanciasAprovadasIds.size}/${instanciaIds.length}` para deixar claro em quantas das instâncias selecionadas aquele template está aprovado.

## Fora de escopo

- Nenhuma mudança em backend, migrations, edge functions ou outras páginas.
- Lógica de envio, round-robin, delay e round-robin de `templateIdByInstance` permanecem idênticos.
