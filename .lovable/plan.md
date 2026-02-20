

## Corrigir busca por nome na pagina "Acordos da Equipe"

### Problema

Quando o usuario pesquisa pelo nome de um cliente (ex: "RONILSON COSTA GUILHERME"), a busca retorna todos os acordos em vez de filtrar corretamente. Isso acontece porque a comparacao por CPF usa `search.replace(/\D/g, '')`, que resulta em uma string vazia quando o termo nao contem digitos. Como qualquer string contem uma string vazia (`"123".includes("") === true`), todos os acordos com CPF preenchido passam no filtro.

### Causa raiz

Linha 388 de `src/pages/EquipeAcordos.tsx`:

```typescript
(acordo.cliente_cpf && acordo.cliente_cpf.replace(/\D/g, '').includes(search.replace(/\D/g, '')))
```

Quando `search` = "RONILSON COSTA GUILHERME", `search.replace(/\D/g, '')` = `""`, e `"qualquerCPF".includes("")` = `true`.

### Correcao

Adicionar uma verificacao para que a comparacao por CPF so ocorra quando o termo de busca contiver digitos numericos. Essa mesma correcao ja foi aplicada em outras paginas do sistema (Meus Acordos, Clientes).

**Arquivo:** `src/pages/EquipeAcordos.tsx`

**Alterar linhas 384-388 de:**
```typescript
const matchesSearch = 
  acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
  acordo.funcionario_nome?.toLowerCase().includes(search.toLowerCase()) ||
  (acordo.cliente_cpf && acordo.cliente_cpf.replace(/\D/g, '').includes(search.replace(/\D/g, '')));
```

**Para:**
```typescript
const searchDigits = search.replace(/\D/g, '');
const matchesSearch = 
  acordo.cliente_nome.toLowerCase().includes(search.toLowerCase()) ||
  acordo.funcionario_nome?.toLowerCase().includes(search.toLowerCase()) ||
  (searchDigits.length > 0 && acordo.cliente_cpf && acordo.cliente_cpf.replace(/\D/g, '').includes(searchDigits));
```

### Resultado esperado

A busca por nome filtrara corretamente, mostrando apenas acordos cujo nome do cliente ou nome do funcionario contenha o termo pesquisado. A busca por CPF continuara funcionando normalmente quando o usuario digitar numeros.

