---
name: Lembretes de atrasados Meta
description: Sequência automática D+1 D+3 D+7 por parcela pendente, remetentes GREEN e etiqueta do funcionário do acordo
type: feature
---
- Dias corridos após vencimento: D+1, D+3, D+7; parar ao pagar ou encerrar acordo e após D+10.
- Somente GREEN confirmado e template Utility aprovado, respeitando bloqueios e blacklist.
- Template inicial novo_lembrete_envio_boleto_variavel/pt_BR: 1 nome do cliente, 2 credor do acordo, 3 vencimento DD/MM/AAAA. Preservar texto e botões.
- Vincular conversa ao funcionário que lançou acordo; se não tiver acesso a caixa compatível, aguardar e mostrar motivo. Nunca ampliar acesso ou substituir por outro atendente.
- Não enviar aos domingos; retomar segunda após 08h BRT, sem acumular etapas antigas.
- Usuário autorizou custo com controle, estimativa e pausa; testes sem envios, ativação após conferir prévia com responsável.
- Em 07/10/2026, autorizou também a continuação temporária de até 180 execuções/dia durante o ciclo limitado, encerrada ao concluir.
- Busca HSM no Envio Meta deve encontrar nome e conteúdo, ignorando acentos e maiúsculas, mantendo favoritos.