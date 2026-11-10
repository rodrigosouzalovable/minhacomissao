# Respeitar o credor certo quando o cliente tem mais de um acordo ativo

## O que aconteceu com a Elinalva (CPF 026.388.671-95)
- Ela tem **dois acordos ativos**: um **NOVO MUNDO** (set/2026, parcela 3 vence 11/11, pendente) e um **UME** antigo (mai/2026, 3 parcelas pagas, ainda marcado como ativo).
- O lembrete D-1 das 09h30 montou a mensagem certa ("NOVO MUNDO"), porque partiu da parcela que vence amanhã.
- Na hora de criar a campanha, a correção que fizemos antes ("credor do acordo prevalece") busca os acordos ativos do CPF e fica só com **o último que aparecer** — no caso, o UME. Aí trocou "NOVO MUNDO" por "UME".

## Correção
- Quando o CPF tiver **vários acordos ativos**, o sistema guarda todos os credores dele.
- Se o credor que já veio na mensagem (da parcela ou da planilha) **é um desses credores**, ele é mantido — nada é trocado.
- Só troca quando o credor informado **não bate com nenhum** acordo ativo do CPF:
  - se o CPF tiver só um credor ativo, usa esse;
  - se tiver vários e nenhum bater, mantém o informado (não arrisca chutar).
- Vale para todos os envios que passam pela criação de campanhas (lembrete D-1, repescagem, Envio Meta e multi-credor).

## Fora do escopo (só aviso)
- O acordo UME antigo dela está com todas as parcelas que existem pagas, mas segue "ativo". Não vou mudar status de acordos (regra: desativação só manual). Posso listar depois quantos casos assim existem, se quiser.

## Detalhes técnicos
- `supabase/functions/_shared/credor-acordo.ts`: `aplicarCredorDoAcordo` passa a receber a lista de empresas ativas do CPF; mantém `item.credor` (ou o rótulo encontrado em `vars`) quando pertence à lista; troca apenas com lista de um único credor.
- `envio-meta-massa-iniciar/index.ts`: `empresaPorCpf` vira `Map<string, Set<string>>`.
- Testes novos: CPF com NOVO MUNDO + UME e mensagem "NOVO MUNDO" continua NOVO MUNDO; CPF só UME com planilha "NOVO MUNDO" vira UME; vários credores sem correspondência mantém o informado.
- Reimplantar `envio-meta-massa-iniciar`.
