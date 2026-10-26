# Telefone automático e opção de formalizar no WhatsApp (portal)

## 1. Telefone formatado enquanto o cliente digita
- O cliente digita só os números (ex.: 62999999999) e o campo vira na hora **(62) 99999-9999**.
- Também funciona ao colar o número, com ou sem +55 (o 55 inicial é removido quando sobrar mais de 11 dígitos).
- Letras e símbolos são ignorados; limite de 11 dígitos.
- O botão "Confirmar acordo e gerar PIX" libera assim que o celular estiver completo.

## 2. Novo botão "Formalizar acordo no WhatsApp"
- Fica ao lado do "Confirmar acordo e gerar PIX" (um abaixo do outro no celular).
- Liberado assim que condição e data estiverem escolhidas, sem exigir telefone.
- Abre o WhatsApp oficial com a mesma mensagem de antes: nome, CPF, credor, contratos, principal, acréscimo, total, parcelas e primeiro pagamento.

## Detalhes técnicos
- `PortalWalletSection.tsx`: usar `maskTelefone` no `onChange` (já existe, não estava aplicado) e tratar prefixo 55; agrupar os dois botões em `flex flex-col sm:flex-row gap-3`, o novo como `variant="outline"` com `href={whatsapp}` (texto já gerado por `portalProposalText`).
