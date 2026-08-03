# Plano: Link de WhatsApp para verificar proposta

## Objetivo
Criar um link curto público `https://meusacordos.com.br/ir/verificar-proposta-odres` que redirecione o usuário para uma conversa no WhatsApp com o número **5561982535396** e a mensagem pré-preenchida:

> "Olá! Recebi uma mensagem e quero verificar a proposta."

## Como será feito
Replicar o padrão já existente da rota `/ir/boleto` (`RedirectBoleto.tsx`):

1. Criar o componente `src/pages/RedirectVerificarProposta.tsx` com:
   - Redirecionamento automático para `https://wa.me/5561982535396?text=<mensagem codificada>`.
   - Tela intermediária com botão "Abrir WhatsApp" caso o redirecionamento não funcione.

2. Adicionar a rota em `src/App.tsx`:
   - Caminho: `/ir/verificar-proposta-odres`
   - Componente: `RedirectVerificarProposta` (lazy-loaded).

3. Não será necessário backend, banco de dados ou autenticação — a rota será pública, igual ao `/ir/boleto`.

## Arquivos alterados
- `src/pages/RedirectVerificarProposta.tsx` (novo)
- `src/App.tsx` (adicionar rota)
