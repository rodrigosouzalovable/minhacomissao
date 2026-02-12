

## Plano: Simplificar página de login

### O que será feito

Remover a aba "Cadastrar" e o link "Esqueceu sua senha?" da página de login (`src/pages/Auth.tsx`), deixando apenas o formulário de login simples.

### Alterações no arquivo `src/pages/Auth.tsx`

1. **Remover o sistema de Tabs** — Substituir o componente `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` por apenas o formulário de login direto
2. **Remover o botão "Esqueceu sua senha?"** — Eliminar o `Button` com `variant="link"` que ativa o fluxo de reset
3. **Remover código morto** — Eliminar:
   - Estado `signupData` e `showResetPassword`/`resetEmail`
   - Função `handleSignup` e `handleResetPassword`
   - Schema `signupSchema` e `resetSchema`
   - Todo o bloco condicional `if (showResetPassword)` com o formulário de recuperação
   - Imports não utilizados (`Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`)

### Resultado final

A página mostrará apenas: logo + título "MEUS ACORDOS", campos E-mail e Senha, e botão "Entrar".

