

# Plano: Corrigir exibição de lembretes e token fantasma da Daniela

## Problemas identificados

1. **Painel de lembretes mostra contagem global**: O `LembretesSection` conta TODAS as mensagens da `whatsapp_fila` do dia, de todos os operadores. O usuário espera ver apenas as do seu telefone "apenas lembretes".

2. **Token fantasma da Daniela**: As mensagens da Daniela na fila usam token `c1d97981-...` que não existe em `user_whatsapp_instances`. Sua instância "apenas lembretes" real tem token `3da9c925-...` (62982183144). As 5 mensagens "enviadas" provavelmente saíram de um número antigo/desconectado.

## Correções

### 1. Corrigir token da Daniela na fila pendente
- Executar UPDATE na `whatsapp_fila` para corrigir as mensagens pendentes da Daniela, trocando o token `c1d97981-...` pelo correto `3da9c925-...`
- Isso garante que as próximas mensagens pendentes dela sairão do telefone correto (62982183144)

### 2. Melhorar visibilidade no painel (LembretesSection)
- Adicionar breakdown por operador/instância no painel de envios do dia
- Mostrar quais mensagens são do telefone "apenas lembretes" selecionado vs de outros operadores
- Manter a contagem total mas adicionar detalhamento:
  ```
  Envios do dia
  7 de 26 enviados | 19 pendente(s)
  ├ Seu telefone (62982198675): 1 enviado, 11 pendentes
  ├ Daniela (62982183144): 5 enviados, 6 pendentes  
  └ Maria Gabriela: 1 enviado, 2 pendentes
  ```

### Arquivos alterados
- **Migration SQL**: UPDATE nas mensagens pendentes da Daniela para corrigir o token
- **`src/components/LembretesSection.tsx`**: Adicionar query com JOIN para agrupar por operador e mostrar breakdown detalhado no painel

