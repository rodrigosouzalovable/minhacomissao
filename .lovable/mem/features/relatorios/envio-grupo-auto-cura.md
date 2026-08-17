---
name: Relatórios no grupo com auto-cura de instância
description: Envio do relatório de acionamentos em grupo tenta todas as instâncias UAZAPI conectadas, grava a que funcionou e avisa o admin em caso de falha total
type: feature
---
- A instância salva em `relatorio_destinos.instancia_id` é apenas **preferência**; só é usada se ainda existir e estiver `ativo = true`.
- `notificar-numeros.ts` percorre todas as instâncias ativas conectadas (timeout de status 8s + retry), descarta em runtime as banidas/desconectadas e trata "not participating in that group" como erro retryable (tenta a próxima).
- Ao enviar com sucesso, `instanciaUsadaPorDestino` atualiza `relatorio_destinos.instancia_id` (auto-cura).
- Se nenhum envio sair, o sistema manda um aviso de falha aos números fixos com o erro real de cada instância.
- Erro "you're not participating in that group" em todas as instâncias significa que nenhum número do sistema está dentro do grupo — é necessário adicionar um número ao grupo no WhatsApp (não é problema de código).
