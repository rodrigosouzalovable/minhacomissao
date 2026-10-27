# Aviso de liberação rápida abaixo da data de pagamento

## O que muda (só para Odres Cred)
- Logo abaixo da escolha da data do primeiro pagamento (embaixo da frase "Pagamento em até 10 dias..."), aparece o aviso em destaque:
  "Liberação rápida: pagando via PIX, o desbloqueio do seu telefone é liberado em até 2 horas após o pagamento."
- O aviso tem o mesmo visual do aviso de cima (ícone de raio, fundo verde claro), para ser notado na hora em que o cliente escolhe a data.
- O aviso que já existe no topo do cartão Odres continua onde está.
- UME e Novo Mundo não mudam.

## Detalhes técnicos
- `src/components/portal/PortalWalletSection.tsx`: incluir o bloco do aviso logo depois da linha de prazo, dentro do bloco de data, condicionado a `wallet.credor === 'odres_cred'`.
