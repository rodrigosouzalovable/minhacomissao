# Separar as caixas do Inbox Meta por operador

## O que foi encontrado
- Sua caixa PADRÃO mostra toda conversa "sem caixa", de qualquer dono de número.
- Nos últimos 10 dias, 4 campanhas do Thiago foram iniciadas sem escolher caixa. Resultado: 729 conversas dos números dele caíram na sua PADRÃO.
- Hoje há 1.938 conversas dos números do Thiago dentro da sua PADRÃO.
- O contrário não acontece: nenhuma conversa dos seus números está nas caixas do Thiago.

## O que será feito
1. **Campanha do Thiago exige caixa**: no Envio Meta, o Thiago (e qualquer parceiro com números próprios) só consegue iniciar a campanha depois de escolher uma das caixas dele. O servidor também recusa campanha de parceiro sem caixa, para não depender só da tela.
2. **Respostas sem caixa vão para AMARAL NM**: quando um cliente escrever para um número do Thiago e a conversa não tiver caixa, ela entra na AMARAL NM, nunca na sua PADRÃO.
3. **Sua PADRÃO fica só com os seus números**: a caixa PADRÃO passa a mostrar somente conversas de números seus.
4. **Mover as 1.938 conversas antigas** dos números do Thiago da sua PADRÃO para a AMARAL NM. Nada é apagado; histórico e etiquetas continuam.
5. Suas campanhas continuam indo para a PADRÃO, como hoje.

## Detalhes técnicos
- `EnvioMeta.tsx`: se `parceiroMeta`, botão de iniciar bloqueado até `folder_id` escolhido entre as caixas do parceiro.
- `send-whatsapp-meta-handler.ts` / criação de `envio_meta_job`: se o dono da instância é parceiro e não veio `folder_id`, usar a caixa padrão do parceiro (AMARAL NM) em vez de `null`; criação de job de parceiro sem pasta rejeitada.
- `meta-whatsapp-webhook` (criação de contato ~linha 865) e `send-whatsapp-meta-text`: fallback para a caixa do parceiro quando a instância é de parceiro.
- Nova coluna `user_permissions.meta_folder_padrao_id` (caixa de destino do parceiro), preenchida com AMARAL NM para o Thiago — evita nome fixo no código.
- Filtro da aba PADRÃO no `InboxMeta.tsx`: `folder_id IS NULL` + instância de dono não parceiro.
- Movimentação dos dados: atualizar `folder_id` das conversas com `folder_id NULL` de instâncias do Thiago para AMARAL NM.
- Teste: parceiro sem caixa → destino AMARAL NM; dono admin sem caixa → PADRÃO.
- Sem custo novo: nenhum agendamento, polling ou Realtime novo.
