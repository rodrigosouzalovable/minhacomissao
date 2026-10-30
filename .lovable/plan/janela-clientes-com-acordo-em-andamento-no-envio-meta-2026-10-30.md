# Janela "Clientes com acordo em andamento" no Envio Meta

## O que muda
1. **Botões centralizados e organizados:** texto centralizado e botões empilhados no centro, na ordem:
   - "Continuar sem eles" (principal, em destaque)
   - "Baixar planilha dos retirados"
   - "Cancelar" (discreto)
   No celular e no computador os botões ficam com a mesma largura, centralizados.
2. **"Continuar sem eles" segue o disparo:** retira os clientes com acordo da lista e já continua as etapas seguintes (confirmação do disparo, aviso de quem já recebeu, cota etc.), sem fechar e sem precisar clicar em "Disparar" de novo. O botão mostra carregamento enquanto continua.
3. "Cancelar" continua só fechando, sem alterar a lista.

Nenhuma regra de envio muda: a varredura de acordos, as confirmações e os limites continuam iguais.

## Detalhes técnicos
- `EnvioMeta.tsx`: no clique de "Continuar sem eles", `setRecipientsRaw(novoTexto)`, fechar o diálogo e marcar `retomarDisparoRef = true`; um `useEffect` em `recipientsRaw` chama `enviar()` quando o ref estiver ativo (garante que use a lista já filtrada). A nova varredura não encontra mais excluídos, então segue direto.
- Layout: `DialogHeader` com `text-center`, rodapé `flex flex-col items-center gap-2` com botões `w-full sm:w-72`.
