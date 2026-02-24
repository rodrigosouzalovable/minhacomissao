

# Substituir cards separados por abas "A ENVIAR" e "ENVIADOS" com contador diario

## Resumo
Substituir os dois cards separados (Pendentes e Mensagens Enviadas) por um unico card com dois botoes/abas no topo: "A ENVIAR" e "ENVIADOS". O botao "ENVIADOS" tera um contador que mostra quantos clientes foram acionados no dia atual, zerando automaticamente a meia-noite.

## Alteracoes em `src/pages/Acionamento.tsx`

### 1. Novo estado para controlar a aba ativa
- `activeTab: 'pendentes' | 'enviados'` com valor inicial `'pendentes'`

### 2. Contador diario de envios
- Calcular `enviadosHoje` filtrando os enviados cujo timestamp de envio e do dia atual
- Precisamos registrar o timestamp de cada envio. Adicionar um novo estado `sendTimestamps: Record<number, string>` (indice -> ISO date string) persistido no localStorage por planilha (`acionamento_send_timestamps_[ID]`)
- Ao enviar com sucesso ou marcar manualmente, registrar `new Date().toISOString()` no `sendTimestamps`
- `enviadosHoje = enviados.filter(c => sendTimestamps[c.originalIndex] e de hoje)`
- "Hoje" = comparar apenas a data (ano/mes/dia), assim zera automaticamente a meia-noite

### 3. UI - Botoes de aba
- Dentro do card, no header, renderizar dois botoes lado a lado:
  - **"A ENVIAR"** - exibe a tabela de pendentes
  - **"ENVIADOS (X)"** - onde X e o `enviadosHoje`, exibe a tabela de enviados
- Botao ativo tera estilo destacado (bg-primary, text-white); inativo tera estilo outline
- Abaixo dos botoes, renderizar condicionalmente a tabela correspondente

### 4. Estrutura do card unico
```text
┌─────────────────────────────────────────┐
│  [A ENVIAR]    [ENVIADOS (12)]          │
├─────────────────────────────────────────┤
│  Nome  │ Telefone │ Atraso │ Saldo │ ...│
│  ...   │ ...      │ ...    │ ...   │ ...│
└─────────────────────────────────────────┘
```

### 5. Detalhes tecnicos
- Nova constante `SEND_TIMESTAMPS_KEY = 'acionamento_send_timestamps'`
- No `handleSend` (sucesso): salvar timestamp no estado e localStorage
- No `handleManualCheck` (checked=true): salvar timestamp
- No `useEffect` inicial e `handleLoadHistorico`: restaurar timestamps do localStorage
- No `handleDeleteHistorico`: limpar timestamps do localStorage
- Funcao auxiliar `isToday(isoString)`: compara date parts com `new Date()` para determinar se e do dia atual
- O contador no botao "ENVIADOS" mostra apenas os do dia; a lista completa mostra todos os enviados (independente do dia)

