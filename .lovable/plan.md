# Botão "Mostrar no Inbox Meta" nas instâncias UAZAPI

## Resultado
- Cada cartão de instância da aba UAZAPI ganha a chave **Inbox Meta** (ligar/desligar).
- Ligada: o número aparece no Inbox Meta Oficial, na caixa **PADRÃO**, marcado como "Não oficial". As mensagens recebidas entram lá e os funcionários respondem por esse mesmo número, como nos números oficiais.
- O **IAGO não responde** nesses números: só os funcionários atendem.
- Desligada: o número sai do Inbox e para de receber conversas novas lá. O histórico já recebido continua guardado.
- A instância WALLACE (62) 8174-6479 pode ser ligada logo após a mudança.

## Regras
- Só o administrador proprietário vê e usa a chave (igual aos outros controles sensíveis do cartão).
- Números já vinculados hoje à caixa AQUECIMENTO continuam como estão; a chave nova só manda para PADRÃO os números ligados por ela.
- Números com a chave ligada ficam fora do rodízio do IAGO e de campanhas, cobrança e evolução de tier.
- Grupos e status continuam bloqueados.

## Detalhes técnicos
- Nova coluna `inbox_meta_ativo boolean default false` em `user_whatsapp_instances`.
- Ao ligar: cria ou reativa o espelho em `meta_whatsapp_instances` (`provider='uazapi'`, `folder_padrao_id` = caixa PADRÃO) e marca `iago_desativado=true`. Ao desligar: espelho `ativo=false` (sem apagar contatos/mensagens).
- `whatsapp-chatbot`: só espelha entrada no Inbox Meta quando o espelho está ativo; já respeita `iago_desativado`, então o IAGO não é acionado.
- Envio pelo Inbox já roteia `provider='uazapi'` pela UAZAPI do número — sem mudança.
- Garantir que a caixa PADRÃO aceita conversas desses espelhos sem entrar no rodízio do IAGO.
- Sem novo agendamento, consulta periódica ou canal em tempo real: custo apenas proporcional às mensagens desse número.
