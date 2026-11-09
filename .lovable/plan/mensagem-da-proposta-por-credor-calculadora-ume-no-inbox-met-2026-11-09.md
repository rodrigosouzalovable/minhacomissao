# Mensagem da proposta por credor (Calculadora UME no Inbox Meta)

## O que muda para o atendente
1. **Configurar mensagem da proposta** ganha no topo um seletor de credor: **UME**, **Odres Cred** e **Novo Mundo**.
   - Cada credor tem o seu próprio texto e as suas próprias opções (à vista ligado/desligado, parcelas 2x–18x).
   - Ao trocar o credor no seletor, o texto e as opções daquele credor aparecem para editar. "Salvar modelo" salva só o credor escolhido. "Restaurar modelo padrão" vale só para ele.
2. **Na hora de enviar**, acima da prévia da mensagem aparece um seletor "Credor da proposta".
   - Ao escolher o credor, a prévia é refeita na hora com o texto e as parcelas configurados para ele.
   - Sugestão automática: o seletor já vem com o credor do CPF do cliente, quando o sistema souber; senão vem UME. O atendente pode trocar.
3. O que já está salvo hoje (texto e parcelas do Wesley e dos demais) passa a ser o modelo da **UME**, sem perder nada. Odres Cred e Novo Mundo começam com o modelo padrão até alguém configurar.

## Regras que continuam iguais
- Valores, descontos e parcelas continuam vindo da consulta da UME; a mudança é só no texto e nas opções exibidas.
- Cada atendente tem os seus próprios modelos, salvos na conta.
- Nenhuma consulta nova automática nem custo extra.

## Detalhes técnicos
- Banco: adicionar coluna `credor text not null default 'ume'` em `ume_proposta_modelos`, trocar a chave única de `user_id` para `(user_id, credor)`. Registros existentes ficam como `ume`. Políticas atuais (dono) seguem valendo.
- `ConfigurarModeloUmeDialog.tsx`: estado `credor`, carrega/salva com `upsert(..., { onConflict: 'user_id,credor' })`.
- `ConsultaUmeDialog.tsx`: carrega todos os modelos do usuário de uma vez (`select texto, opcoes, credor`), guarda em mapa por credor; seletor recalcula `previa` via `textoFinal` com modelo/opções do credor; padrão vindo de `identificar_credor_por_cpf` (já existente) quando disponível.
- `umePropostaModelo.ts`: tipo `CredorProposta` e fallback local por credor.
- Teste: modelo por credor gera texto/parcelas corretos e credor sem modelo usa o padrão.
