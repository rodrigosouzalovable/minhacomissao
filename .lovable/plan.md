

# Corrigir Filtro de Estagio na Tela de Clientes

## Problema
Quando um evento e registrado na ficha do cliente, a tag muda visualmente de "NOVO" para "ANDAMENTO", porem essa mudanca **nao e salva no banco de dados**. O campo `estagio` na tabela `devedores` continua como "novo". Por isso, ao pesquisar por "Andamento" no filtro de Estagio, nenhum resultado aparece.

## Solucao
Atualizar o campo `estagio` no banco de dados para "andamento" no momento em que um evento e registrado. Assim, a pesquisa por estagio funcionara corretamente.

## Mudancas

### Arquivo: `src/pages/DevedorDetalhe.tsx`
Apos a insercao do evento com sucesso (linha ~207), adicionar uma chamada para atualizar o `estagio` do devedor de "novo" para "andamento":

```typescript
// Apos o insert do evento ser bem-sucedido:
if (devedor?.estagio === 'novo') {
  await supabase.from('devedores').update({ estagio: 'andamento' }).eq('id', id);
}
```

Isso garante que:
- Somente devedores com estagio "novo" serao alterados para "andamento"
- Devedores ja em "andamento" ou "finalizado" nao serao afetados
- A mudanca sera persistida no banco, permitindo que o filtro de Estagio na tela de Clientes funcione corretamente para todos os estagios

### Arquivo: `src/pages/DevedorDetalhe.tsx` (badge visual)
Remover a logica condicional do badge que simulava o estagio "andamento" com base na existencia de eventos (linha ~721-722), pois agora o valor real estara no banco.

