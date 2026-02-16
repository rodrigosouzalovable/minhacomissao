

## Ajustar proporções do layout da ficha do cliente

Inverter a proporção entre a coluna esquerda (Telefone/Dados + Contratos) e a coluna direita (Eventos), dando mais espaço aos Eventos.

### Mudança

No arquivo `src/pages/DevedorDetalhe.tsx`, alterar o grid de 3 colunas:

- **Coluna esquerda** (Telefone + Contratos): de `lg:col-span-2` para `lg:col-span-1`
- **Coluna direita** (Eventos): de 1 coluna para `lg:col-span-2`

Isso muda a proporção de 66%/33% para 33%/66%, dando o dobro de espaço para a seção de Eventos.

### Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/DevedorDetalhe.tsx` | Trocar `lg:col-span-2` da div esquerda para a div direita (Eventos) |

