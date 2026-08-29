# Certificado Digital — coleta automática de leads de CNPJs recém-abertos

Etapa 1: apenas extração e a aba de leads. Sem envio de mensagens, sem caixa dedicada e sem a IA ainda (ficam para a etapa 2).

## O que você terá

Nova aba lateral **Certificado Digital** com:

- **Motor desligado por padrão** — um botão liga/desliga a coleta diária. Nada roda até você ligar.
- **Coleta diária automática** (quando ligada): o sistema consulta a Casa dos Dados e traz CNPJs abertos em cada janela de D+0 até D-30, guardando telefone, nome, CNAE, cidade/UF, porte e data de abertura.
- **Lista de leads** com filtros por UF, CNAE, porte, dia de abertura (D+0…D-30), "tem telefone celular" e status.
- **Painel de teste de melhor dia**: quantos leads e quantos telefones válidos por cada dia de abertura, preparando a comparação de conversão quando o envio existir.
- **Exportação Excel** dos leads filtrados.
- **Coleta manual**: botão "Buscar agora" para testar uma janela específica sem esperar o cron.

## Filtros da busca

- Estados: GO, SP, RS, RJ, SC, DF.
- Todos os portes, incluindo MEI.
- CNAEs: 6911701, 7020400, 8630504, 7490104, 4712100, 6319400, 7319002, 8630503, 8112500, 4120400, 6201501, 9602501, 4772500, 4751201, 4781400, 4530703, 6204000.
- Os filtros ficam editáveis na tela (adicionar/remover CNAE e UF sem mexer no código).

## Detalhes técnicos

Backend:
- Segredo `CASA_DOS_DADOS_API_KEY` (a mesma chave do projeto Certificadora CNPJ — vou pedir por um campo seguro).
- Tabela `certificado_leads`: cnpj (único), razao social, nome fantasia, telefones (jsonb), telefone principal normalizado (55+DDD+9), email, cnae, uf, municipio, porte, data_abertura, dias_desde_abertura, origem_janela, status (`novo` | `sem_telefone` | `duplicado` | `enviado` | `blacklist`), created_at.
- Tabela `certificado_config`: motor_ativo, ufs[], cnaes[], janelas_dias[], porte, hora_execucao, ultima_execucao, contadores.
- Tabela `certificado_coleta_log`: janela, total encontrado, novos, duplicados, sem telefone, erro, timestamp.
- Todas com RLS + GRANT: leitura/escrita para admins (e usuários com a aba permitida); `service_role` completo para as functions.
- Edge function `certificado-casa-dados-buscar`: paginação, deduplicação por CNPJ, normalização de telefone (celular = 9 dígitos), descarte de fixos opcional, respeito ao limite de requisições da API, e checagem contra a blacklist existente.
- Edge function `certificado-coleta-tick` com cron diário (07:30 BRT). Primeira linha do código: se `motor_ativo = false`, sai sem consumir nada.

Frontend:
- `src/pages/CertificadoDigital.tsx` + rota `/admin/certificado-digital` (PermissionRoute) e item no menu lateral.
- Componentes: `CertificadoMotorCard` (liga/desliga + status da última execução), `CertificadoFiltrosCard`, `CertificadoLeadsTable`, `CertificadoMelhorDiaCard`.

## Aviso de custo (Lovable Cloud)

Isso adiciona **1 cron diário** e **1 tabela que cresce** (~centenas a milhares de linhas/dia). Impacto pequeno, mas real. Mitigações incluídas: motor desligado por padrão, execução única diária, índices em cnpj/uf/data_abertura, paginação na tabela e `staleTime` alto nas queries.

## Etapa 2 (depois, quando você pedir)

Caixa de mensagens dedicada no Inbox Meta Oficial, disparo pela API oficial com os números que você conectar, e a IA **CLARA CERTIFICA** atendendo as respostas no mesmo modelo do IAGO (personalidade, ensinar, nunca fazer, follow-up).
