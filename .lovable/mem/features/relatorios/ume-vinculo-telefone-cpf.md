---
name: Arquivo UME — vínculo telefone → CPF
description: Arquivo diário UME só exporta acionamentos com CPF identificado; vínculo vem da tabela acionamento_telefone_cpf
type: feature
---

O painel de Relatórios conta todos os acionamentos do dia (todas as carteiras, incluindo ligações 3C). O arquivo diário UME só exporta o que tem CPF da carteira `ume_novo_mundo%`.

Fatos:
- Devedores UME não têm telefone (0 de 750k linhas) → ligações e Inbox não casam direto.
- `envio_meta_job_item.cpf` frequentemente traz código de contrato/ID, não CPF.

Solução:
- Tabela `acionamento_telefone_cpf` (sufixo de 8 dígitos → CPF), alimentada por acordos, retornos, mailings com CPF de 11 dígitos, IAGO, portal e contatos do Inbox.
- RPC `acionamento_vincular_telefone_cpf(_pares jsonb)` é chamada por `envio-meta-massa-iniciar` a cada campanha (só CPF com 11 dígitos).
- `relatorio_ume_acionamentos` resolve CPF por telefone via esse mapa + contatos Inbox + devedor_telefones.
- `relatorio_ume_cobertura(_data)` e `relatorio_ume_sem_vinculo(_data)` alimentam o card com cobertura e exportação dos telefones sem vínculo.
