# Excel do UME sai com 50 linhas mesmo com 9.289 acionamentos

## O que está acontecendo (verificado nos dados de hoje, 17/08)

Os dois números medem coisas diferentes:

- **9.289 acionamentos** no painel = tudo do dia, de todas as carteiras (a maior parte são ligações do discador 3C: 7.416 ligações hoje).
- **Excel do UME** = só as linhas que o sistema consegue provar que são de um CPF da carteira UME/Novo Mundo. Hoje ele só consegue provar 50 (acordos lançados e parcelas pagas).

Por que ele não consegue provar o resto:

| Fonte do dia | Volume | Vira linha no arquivo UME? |
|---|---|---|
| Ligações 3C | 7.416 | Não — 0 casam com telefone UME |
| Envios WhatsApp (campanhas) | 1.429 | Não — 0 têm CPF válido |
| Respostas no Inbox | 622 | Não — 0 casam com telefone UME |
| Acordos + pagamentos | ~50 | Sim |

Duas causas confirmadas:

1. **A carteira UME não tem telefone.** São 750.052 linhas de devedores UME com CPF, e **zero** com telefone preenchido. Como ligação e Inbox só têm telefone, não há como ligar o acionamento ao CPF.
2. **O campo CPF das campanhas não tem CPF.** Nos 1.429 envios de hoje, nenhum tem 11 dígitos — vêm códigos de contrato/ID (ex.: `2104181`). Também testei casar esse código com o contrato do UME: só 4 de 1.429 casaram.

## O que será feito

### 1. Tabela de vínculo telefone → CPF
Criar um mapa único de telefone → CPF (por sufixo de 8 dígitos), alimentado por:
- planilhas de mailing importadas (Envio Meta / Estratégias) — CPF e telefone na mesma linha;
- contatos do Inbox Meta que já têm CPF (hoje há 6.503 vínculos utilizáveis para o UME);
- consultas de CPF do portal já registradas.

### 2. Gravar o vínculo no momento do disparo
No Envio Meta, ao importar a planilha e ao processar cada envio, gravar o CPF real (validando 11 dígitos) e alimentar o mapa telefone → CPF. Se a coluna mapeada não for CPF válido, avisar na tela antes do disparo, para não perder a rastreabilidade da carteira.

### 3. Arquivo diário passa a resolver o CPF pelo mapa
O relatório UME passa a atribuir CPF a ligações, envios e respostas do Inbox usando o mapa de telefones (além do vínculo direto que já existe). Assim os acionamentos por telefone entram no arquivo.

### 4. Transparência no card do relatório
No card "Arquivo diário UME", ao "Conferir o dia", mostrar:
- total de acionamentos do dia (todas as carteiras);
- quantos foram atribuídos ao UME;
- quantos ficaram **sem CPF vinculado** (com botão para exportar essa lista de telefones, para conferência).

Isso deixa claro na hora se o arquivo está completo ou se falta vínculo.

### 5. Backfill (opcional, sob confirmação)
Rodar uma carga única do mapa a partir das planilhas de mailing já usadas nas campanhas dos últimos dias e reprocessar as datas pedidas.

## Detalhes técnicos

- Nova tabela `acionamento_telefone_cpf` (`telefone_sufixo` PK, `cpf`, `origem`, `atualizado_em`), com GRANTs para `authenticated`/`service_role`, RLS de leitura para autenticados e escrita só por `service_role`/admin, índice em `telefone_sufixo`.
- `relatorio_ume_acionamentos(_data)`: os CTEs `ligacoes`, `inbound` e `envios_job`/`mailing` passam a resolver o CPF via `acionamento_telefone_cpf` (LEFT JOIN por sufixo) antes de filtrar pela carteira UME; mantidas as regras atuais de CPC uma vez por telefone/dia e de ACAO por disparo.
- Nova RPC `relatorio_ume_cobertura(_data)` devolvendo total do dia, atribuídos ao UME e não atribuídos (com telefones), usada pelo card.
- `src/components/relatorios/ArquivoDiarioUmeCard.tsx`: resumo com cobertura e exportação da lista sem vínculo. A paginação de 5.000 linhas já existente continua.
- Envio Meta: validação de CPF na importação (`MapearColunasImportDialog.tsx`) e upsert no mapa dentro do processamento de envio.

Custo: sem novo cron, sem novo Realtime, sem polling. Só uma tabela de apoio indexada e leituras sob demanda.
