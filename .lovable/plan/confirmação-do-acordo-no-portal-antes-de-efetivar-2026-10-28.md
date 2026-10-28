# Confirmação do acordo no portal antes de efetivar

## O que muda para o cliente
Hoje, no portal, o cliente escolhe a condição e clica direto em "Confirmar acordo e gerar PIX" (UME/Odres) ou "Solicitar esta condição no WhatsApp" (Novo Mundo / formalizar pelo WhatsApp). Ele não vê um resumo antes.

Agora, em todos esses botões, abre primeiro uma janela **"Confira seu acordo"** com:
- Carteira (UME, Odres Cred ou Novo Mundo)
- Forma: À vista ou **Parcelado em Nx** (destacado em letra grande)
- Valor de cada parcela (e da última, se for diferente) e entrada, se houver
- Total do acordo
- Data do primeiro pagamento (ou do pagamento à vista)
- Lista de vencimentos de todas as parcelas
- Telefone informado (quando houver)
- Caixa obrigatória: "Li e confirmo que estou fechando um acordo de Nx de R$ X, com 1º pagamento em DD/MM/AAAA"

Botões: **"Voltar e alterar"** e **"Confirmar acordo"** (só libera depois de marcar a caixa). Somente após essa confirmação o acordo é efetivado no sistema (ou a mensagem do WhatsApp é aberta).

## Detalhes técnicos
- Arquivo: `src/components/portal/PortalWalletSection.tsx`.
- Novo estado `revisando` + `aceite`; os três botões de ação passam a abrir um `Dialog` (shadcn) em vez de chamar `confirmar()` / abrir o link direto.
- No dialog, "Confirmar acordo" chama `confirmar()` existente (autoatendimento) ou abre o link `whatsapp` existente (`window.open`, no próprio clique).
- Vencimentos calculados mensalmente a partir da data escolhida, apenas para exibição (o cálculo de efetivação no servidor não muda).
- Sem mudanças no servidor, valores ou regras de negociação.
