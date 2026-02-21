

## Corrigir importacao COBMAIS e adicionar indicador de carregamento

### Problema

Ao importar a planilha COBMAIS, nada acontece visualmente. O arquivo esta sendo processado em segundo plano (leitura + parsing de 4 abas + cruzamento por CPF), mas nao existe nenhum indicador de carregamento para informar o usuario que deve aguardar.

### Causa raiz

A funcao `handleFile` usa `FileReader.readAsBinaryString()` que e assincrono, mas nao existe um estado `loading` para mostrar feedback visual ao usuario durante o processamento.

### Solucao

**Arquivo:** `src/pages/ImportarDevedores.tsx`

**1. Adicionar novo estado `parsing`**

```typescript
const [parsing, setParsing] = useState(false);
```

**2. Envolver `handleFile` com o estado de loading**

- Setar `setParsing(true)` antes de iniciar a leitura do arquivo
- Setar `setParsing(false)` ao final do `reader.onload`
- Tambem setar `setParsing(false)` em `reader.onerror`

**3. Adicionar indicador visual na UI**

Quando `parsing === true`, exibir um card com animacao de loading abaixo do upload, contendo:
- Um icone de spinner animado (Loader2 do lucide-react)
- Texto "Processando planilha..." em negrito
- Subtexto "Lendo abas e cruzando dados, aguarde..."
- Desabilitar o botao "Escolher arquivo" e "Limpar" durante o parsing

**4. Desabilitar input de arquivo durante o parsing**

Impedir que o usuario selecione outro arquivo enquanto o atual esta sendo processado.

### Secao tecnica

- Unico arquivo modificado: `src/pages/ImportarDevedores.tsx`
- Importar `Loader2` do lucide-react
- Novo estado booleano `parsing`
- Card de loading com spinner animado (`animate-spin`)
- Sem novas dependencias

