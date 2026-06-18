## Objetivo

Tornar a importação persistente entre abas/sessões, permitir marcar clientes já contatados, recalcular descontos automaticamente quando o usuário altera os percentuais globais, e importar todos os telefones marcados como "Sim".

## 1. Persistência da lista importada (localStorage)

- Em `src/pages/ModeloMensagem.tsx`, salvar em `localStorage` (chave `modelo_mensagem_state_v1`):
  - `clientes` (lista importada)
  - `contatados` (Set de CPFs marcados)
  - `descVistaGlobal`, `descParceladoGlobal`
- `useEffect` ao montar: hidrata os estados a partir do `localStorage`.
- `useEffect` em cada mudança relevante: persiste o estado.
- Adicionar botão "Limpar lista" (ao lado de "Selecionar arquivo") para resetar quando o usuário quiser começar do zero.

## 2. Marcar cliente como "Já contatado"

- Nova coluna **"Contatado"** na tabela (primeira coluna) com um `Checkbox`.
- Estado `contatados: Set<string>` (por CPF), persistido junto com a lista.
- Linhas marcadas ganham estilo apagado (`opacity-50`, texto riscado no nome) para indicar visualmente.
- Contador no topo: "X de Y contatados".

## 3. Recalcular descontos automaticamente

- Hoje a mensagem usa `configs[cpf]`, que só é atualizado ao clicar "Aplicar a todos". 
- Mudar `mensagemDoCliente` para usar diretamente `descVistaGlobal` e `descParceladoGlobal` como fonte da verdade (remover `configs` e `LinhaConfig`, já que o controle por linha foi removido em mudanças anteriores).
- Resultado: ao alterar qualquer percentual nos inputs globais, todas as mensagens da tabela atualizam em tempo real, sem precisar clicar em "Aplicar".
- O botão "Aplicar a todos" deixa de ser necessário e será removido (ou mantido apenas como atalho visual — decisão: **remover** para simplificar).

## 4. Importar todos os telefones marcados como "Sim"

- Em `src/lib/parseCobmaisPlanilha.ts`:
  - Mudar `ClienteImportado.telefone: string` → `telefones: string[]`.
  - No parser da aba **Telefones**, acumular todos os números cujo `CONTATO === "Sim"` (deduplicados), em vez de parar no primeiro.
- Em `ModeloMensagem.tsx`:
  - Renderizar a coluna **Telefone** como lista vertical — cada número com seu próprio botão "Copiar" ao lado.
  - Placeholder `{telefone}` no template passa a usar o primeiro telefone (compatibilidade).

## Arquivos afetados

- `src/lib/parseCobmaisPlanilha.ts` — campo `telefones: string[]`, parsing de múltiplos telefones.
- `src/pages/ModeloMensagem.tsx` — persistência em localStorage, coluna "Contatado", recálculo automático, render de múltiplos telefones, remoção de `configs`/`LinhaConfig` e do botão "Aplicar".

## Fora de escopo

- Persistir no backend (Supabase) — `localStorage` atende ao pedido ("ficar fixa mesmo trocando de aba ou fechando"). Se quiser sincronizar entre dispositivos depois, fazemos em um passo separado.
- Mudanças no template/edge functions.