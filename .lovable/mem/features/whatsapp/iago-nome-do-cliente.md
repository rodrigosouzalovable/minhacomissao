---
name: IAGO — nome do cliente
description: IAGO nunca usa o nome do perfil do WhatsApp como nome real; pergunta o nome uma vez e grava em iago_conversa_estado.contexto.nome_informado
type: feature
---

- Prioridade do nome: cadastro (proposta/`resolverTelefone`) > `contexto.nome_informado` > nome do perfil do WhatsApp **só se** `nomePerfilConfiavel()` aprovar.
- `nomePerfilConfiavel` (em `_shared/iago.ts`) rejeita frases religiosas ("Deus é Fiel"), razões sociais, apelidos com símbolos/números, >3 palavras.
- Sem nome confiável e `contexto.nome_pedido` falso: o IAGO responde o que o cliente pediu e, na mesma leva, pergunta o nome de forma natural. Nunca chama o cliente por nenhum nome nessa resposta e não insiste depois (uma tentativa por conversa).
- `extrairNomeInformado()` capta "meu nome é X", "me chamo X", "sou o X", "aqui é X" ou nome isolado em mensagem curta; grava em `contexto.nome_informado` e corrige `meta_whatsapp_contatos.nome` quando o salvo era só o pushName não confiável.
- `iago-followup-tick` usa o mesmo critério (nome_informado > perfil confiável).
