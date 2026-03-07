

# Melhorar o Sistema de Aprendizado

## Problemas Identificados

1. **Sessão com erro não foi limpa**: 2 passos com URLs `chrome-error://` que vão confundir a IA
2. **Excesso de eventos `navigate`**: Redirecionamentos automáticos do browser (login OAuth) são capturados como "passos", gerando ruído. Dos 24 passos, ~15 são navegações automáticas.
3. **Faltam as ações de boleto**: A gravação parou antes dos cliques reais de geração de boleto

## Solução

### 1. Limpar dados ruins (migração SQL)
- Deletar todos os registros da sessão com erro (`c21aeb07`)
- Deletar a própria sessão
- Filtrar navegações duplicadas consecutivas da sessão boa (manter apenas a última de cada URL)

### 2. Melhorar o filtro de gravação no `server.js`
- Ignorar `navigate` events para URLs que são redirecionamentos (mesma URL repetida, `chrome-error://`, callbacks OAuth)
- Ignorar cliques em elementos genéricos como `div.login` quando não têm seletor específico
- Só gravar `navigate` quando a URL base realmente muda

### 3. Adicionar aba "Conhecimento" na UI (`AutomacaoCobMais.tsx`)
- Mostrar lista de sessões gravadas com status e total de passos
- Botão para deletar sessões ruins
- Visualização dos passos de cada sessão em formato legível
- Botão para "testar" o conhecimento: rodar o agente com um objetivo que corresponda ao fluxo gravado

### 4. Melhorar injeção de conhecimento no `analyze-cobmais-screen`
- Filtrar passos do tipo `navigate` consecutivos antes de injetar no prompt
- Dar mais peso a ações `click` e `fill` (são as mais úteis)

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| SQL migration | Limpar sessão com erro + remover navigates duplicados |
| `server.js` | Filtrar navigates duplicados/automáticos durante gravação |
| `src/pages/AutomacaoCobMais.tsx` | Aba de visualização do conhecimento aprendido |
| `supabase/functions/analyze-cobmais-screen/index.ts` | Filtrar navigates consecutivos antes de injetar no prompt |

