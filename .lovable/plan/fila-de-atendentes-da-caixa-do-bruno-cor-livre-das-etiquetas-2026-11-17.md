# Fila de atendentes da caixa do Bruno + cor livre das etiquetas

## O que encontrei
- **Lorena**: tem uma etiqueta antiga chamada "Atendente: Lorena Bsa", mas o nome dela no cadastro é só "Lorena". A fila procura "Atendente: Lorena" e não encontra, então ela aparece "fora da fila".
- **Larissa Santos**: não existe nenhuma etiqueta "Atendente: Larissa Santos". Por isso ela também aparece fora. Ainda não sei por que a etiqueta não foi criada quando ela foi marcada. O primeiro passo é reproduzir isso com a conta do Bruno.
- **Cores**: o Bruno, como administrador da caixa, já pode trocar a cor de uma etiqueta, mas só dentro de uma paleta fixa de 8 cores.

## O que vou fazer
1. **Colocar os atendentes na fila**
   - Fazer a fila reconhecer a etiqueta do atendente mesmo quando o nome dela é diferente do cadastro atual (caso da Lorena), em vez de exigir o mesmo nome exato.
   - Garantir que marcar uma pessoa na caixa sempre crie a etiqueta e a entrada na fila. Se algo falhar, aparece um aviso claro, sem falhar em silêncio.
   - Incluir agora na fila quem já está marcado na caixa "ODRES-Entradas" e aparece "fora da fila".
   - Isso não muda as regras de acesso: só quem administra a caixa pode mexer nela.
2. **Cor livre para as etiquetas dos atendentes**
   - Na edição da etiqueta, além das 8 cores atuais, adicionar um seletor de cor livre para escolher qualquer cor.
   - Na janela "Atendentes da caixa", mostrar ao lado de cada atendente a bolinha com a cor da etiqueta dele. Ao clicar, o Bruno escolhe a cor que quiser.
   - A cor vale só para a caixa dele, sem mudar a cor nas caixas dos outros.

## Detalhes técnicos
- `meta_fila_status_caixa`, `meta_rodizio_status_caixa` e `meta_provisionar_atendentes_fila`: localizar a etiqueta pela entrada em `meta_atendimento_fila.user_id` do atendente, e não só pelo nome.
- Reproduzir com a conta do Bruno por que o provisionamento não criou a etiqueta da Larissa e corrigir a causa. Rodar o provisionamento uma vez para a ODRES-Entradas.
- Seletor de cor no formato `#RRGGBB`, salvo pela função que já existe, `meta_etiqueta_caixa_salvar` (a cor é por caixa).
- Nenhum agendamento ou consulta repetitiva novo, então não há custo extra.
