# Notificações essenciais pelo novo número 62 98107-9590

## O que muda
- Os avisos ao seu WhatsApp (final 2674) voltam, mas **somente**:
  1. Entrada e saída dos funcionários (ponto)
  2. Pausas / inatividade dos funcionários (aviso aos 10 min e no retorno)
  3. Relatório de acompanhamento diário
- Todos os outros avisos (IAGO humano, acessos, proxies, quedas de instância, alertas Meta etc.) ficam bloqueados por enquanto — registrados como "pausado", sem envio.
- O envio sai **apenas** pelo número 62 98107-9590 (UAZAPI), sem rodízio entre outros chips. Se ele estiver desconectado, o aviso fica registrado como falha, sem tentar outros números.
- Na aba UAZAPI, o interruptor de pausa vira: "Somente avisos essenciais" (ligado) / "Todos" / "Pausar tudo".

## Técnico
- Config admin: nova coluna com lista de tipos permitidos (`ponto_entrada`, `ponto_saida`, `inatividade`, `resumo_diario`) e instância fixa de envio.
- `process-admin-notification-queue`: se o tipo não estiver na lista, marca "pausado"; usa só a instância fixa.
- Primeiro passo: conferir os nomes reais dos tipos de ponto/inatividade gravados na fila e localizar a instância 62981079590.
- Sem novo agendamento ou consulta periódica (custo inalterado).
