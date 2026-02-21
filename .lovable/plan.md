

## Corrigir leitura de planilhas COBMAIS grandes

### Problema raiz

O arquivo tem 17 abas com centenas de milhares de linhas (56K na Cobranca, 184K em Telefones, 319K em Parcelas). O metodo `reader.readAsBinaryString()` nao consegue processar arquivos desse tamanho corretamente - os dados sao truncados ou corrompidos, resultando em 0 linhas lidas na maioria das abas.

### Solucao

**Arquivo: `src/pages/ImportarDevedores.tsx`**

Trocar o metodo de leitura do arquivo de `readAsBinaryString` para `readAsArrayBuffer`, que e mais eficiente e confiavel para arquivos grandes:

1. Alterar `reader.readAsBinaryString(f)` para `reader.readAsArrayBuffer(f)`
2. Alterar `XLSX.read(data, { type: 'binary' })` para `XLSX.read(data, { type: 'array' })`

Sao apenas 2 linhas de alteracao.

### Secao tecnica

**Linha ~255:**
```text
// DE:
XLSX.read(data, { type: 'binary' });
// PARA:
XLSX.read(data, { type: 'array' });
```

**Linha ~280:**
```text
// DE:
reader.readAsBinaryString(f);
// PARA:
reader.readAsArrayBuffer(f);
```

- `readAsArrayBuffer` trabalha com dados binarios puros (sem conversao para string), evitando truncamento e uso excessivo de memoria
- `XLSX.read` com `type: 'array'` aceita `ArrayBuffer` diretamente
- Essa mudanca beneficia todos os layouts (Padrao, Montreal, COBMAIS), nao apenas o COBMAIS
- Sem novas dependencias, sem alteracoes no banco de dados

