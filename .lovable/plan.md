

# Separar clientes em "Pendentes" e "Mensagens Enviadas"

## Resumo
Dividir a tabela de clientes em duas secoes: uma com clientes pendentes de envio e outra com clientes ja acionados. O cliente move automaticamente para "Mensagens Enviadas" ao clicar no icone do WhatsApp (apos sucesso) ou ao marcar um checkbox manual.

## Alteracoes em `src/pages/Acionamento.tsx`

### 1. Adicionar checkbox na tabela
- Importar o componente `Checkbox` de `@/components/ui/checkbox`
- Adicionar uma nova coluna na tabela ao lado do botao WhatsApp com um checkbox
- Ao marcar o checkbox, o cliente e movido para a secao "Mensagens Enviadas" (sem disparar mensagem)

### 2. Logica de separacao
- Derivar dois arrays a partir de `clientes` e `sendStatus`:
  - **Pendentes**: clientes cujo `sendStatus[i]` NAO e `'success'` e que NAO foram marcados manualmente
  - **Mensagens Enviadas**: clientes cujo `sendStatus[i]` e `'success'` OU que foram marcados via checkbox
- Novo estado `manualChecked: Set<number>` para rastrear indices marcados manualmente pelo checkbox
- Persistir `manualChecked` no localStorage junto com o `sendStatus` (mesma chave por planilha)

### 3. Fluxo ao clicar no WhatsApp
- Apos envio com sucesso (`sendStatus` vira `'success'`), o cliente automaticamente aparece na secao "Mensagens Enviadas"
- Nenhuma mudanca na logica de envio existente

### 4. Fluxo ao marcar o checkbox
- Ao marcar, adicionar o indice ao `manualChecked` e persistir no localStorage
- O cliente aparece na secao "Mensagens Enviadas" com um badge indicando "Manual" (para diferenciar dos enviados via WhatsApp)
- Ao desmarcar na secao de enviados, o cliente volta para pendentes

### 5. Renderizacao
- Card "Clientes" passa a mostrar apenas os pendentes, com titulo "Clientes ({pendentes.length})"
- Novo Card "Mensagens Enviadas ({enviados.length})" abaixo, com tabela identica mas sem o botao de envio (apenas o check verde ou badge "Manual")
- Ambas as tabelas mantem as colunas: Nome, Telefone, Atraso, Saldo e uma coluna de status

### Detalhes tecnicos

- Novo estado: `manualChecked: Set<number>` (indices dos clientes marcados manualmente)
- Nova chave localStorage: `acionamento_manual_checked_[ID]` para persistir por planilha
- Computacao derivada:
```typescript
const pendentes = clientes.map((c, i) => ({ ...c, originalIndex: i }))
  .filter(c => sendStatus[c.originalIndex] !== 'success' && !manualChecked.has(c.originalIndex));

const enviados = clientes.map((c, i) => ({ ...c, originalIndex: i }))
  .filter(c => sendStatus[c.originalIndex] === 'success' || manualChecked.has(c.originalIndex));
```
- Checkbox renderizado na coluna de acao, ao lado do botao WhatsApp
- Ao restaurar dados do localStorage (mount e troca de planilha), restaurar tambem o `manualChecked`

