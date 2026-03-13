

# Plano: Formatar nomes nas mensagens de lembrete

## Alteração

Na edge function `check-payment-reminders/index.ts`, adicionar uma função helper para capitalizar nomes (primeira letra maiúscula, resto minúscula) e aplicar em dois pontos:

1. **Nome do cliente**: Extrair apenas o primeiro nome de `acordo.cliente_nome` e aplicar capitalização
2. **Nome do operador**: Aplicar a mesma capitalização no `primeiroNome` do perfil
3. **Todas as mensagens**: Adicionar a frase final "Caso tenha efetuado o pagamento, nos envie o comprovante por gentileza." nas mensagens que ainda não pedem comprovante (D+10, D+11, D+20, D+30, genérico)

### Função helper
```typescript
function capitalizeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
```

### Onde aplicar
- Linha 229: `primeiroNome` → `capitalizeName(primeiroNome)`
- Todas as mensagens: substituir `acordo.cliente_nome` por `capitalizeName(acordo.cliente_nome.split(' ')[0])`
- Mensagens D+10, D+11, D+20, D+30 e genérica: adicionar frase sobre comprovante no final

