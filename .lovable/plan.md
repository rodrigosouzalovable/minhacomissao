

## Corrigir botao "Limpar" para resetar o input de arquivo

### Problema

Ao clicar em "Limpar", os estados internos (`file`, `rows`, `imported`) sao resetados, mas o elemento `<input type="file">` no DOM ainda exibe o nome do arquivo anterior. O usuario nao consegue selecionar o mesmo arquivo novamente nem ve o input como "limpo".

### Solucao

**Arquivo: `src/pages/ImportarDevedores.tsx`**

1. Adicionar um `useRef` para o input de arquivo:
   ```text
   const fileInputRef = useRef<HTMLInputElement>(null);
   ```

2. Associar o ref ao `<Input type="file">`:
   ```text
   <Input ref={fileInputRef} type="file" ... />
   ```

3. No `handleClear`, alem dos states atuais, resetar o valor do input:
   ```text
   const handleClear = () => {
     setFile(null);
     setRows([]);
     setImported(false);
     if (fileInputRef.current) {
       fileInputRef.current.value = '';
     }
   };
   ```

### Secao tecnica

- Unico arquivo modificado: `src/pages/ImportarDevedores.tsx`
- Adiciona `useRef` ao import do React
- Sem novas dependencias, sem alteracoes no banco
