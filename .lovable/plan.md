# Arquivo diário de acionamentos (layout UME) na aba Relatórios

A planilha enviada é o **layout de prestação de contas do credor**: uma linha por tentativa de acionamento do dia, com 9 colunas fixas (DATA_HORA, CPF, ORIGEM, ACIONAMENTO, OCORRENCIA, TELEFONE, EMAIL, AGENTE, ASSESSORIA) e a aba "Dicionário" explicando cada campo. Sim, é possível gerar isso automaticamente todo dia a partir dos dados que já existem no sistema.

## O que aparece na tela

Novo bloco **"Arquivo diário UME"** na aba Relatórios (visível para admin):

- Seletor de data (padrão: hoje) e botão **Baixar Excel**.
- Contadores de conferência antes de baixar: total de linhas, e quebra por origem (WhatsApp, Discador, Mailing).
- Lista dos últimos 30 dias com o total de linhas de cada dia, para você baixar retroativo.
- O arquivo sai em `.xlsx` com duas abas: **Layout** (os dados) e **Dicionário** (idêntico ao modelo enviado), nome `ACIONAMENTOS_UME_ddMMyyyy.xlsx`.

## Como cada coluna é preenchida

| Coluna | Origem no sistema |
|---|---|
| DATA_HORA | horário real do evento em BRT, formato `dd/MM/yyyy HH:mm:ss` |
| CPF | CPF do contato (11 dígitos, com zeros à esquerda) |
| ORIGEM | WHATSAPP, DISCADOR, EMAIL ou SMS |
| ACIONAMENTO | ACAO nas tentativas; CPC quando houve contato/resposta; CONVERSAO quando houve acordo no dia |
| OCORRENCIA | Envio WhatsApp, Discagem Ativa, Exportação Mailing, Contato Com Cliente, Acordo, Pagamento, Quebra de Acordo etc. |
| TELEFONE | telefone usado no acionamento (só dígitos, sem 55) |
| EMAIL | vazio hoje (sem envio de e-mail no sistema) |
| AGENTE | nome do operador responsável; `AUTO` quando foi automação/IA |
| ASSESSORIA | fixo `SOUZA E RIBEIRO` |

Filtro de carteira: só entram CPFs da carteira **UME/Novo Mundo** (inclui a base de aporte).

### Fontes dos eventos

- **Envio WhatsApp (ORIGEM=WHATSAPP, ACAO)** — itens processados das campanhas do Envio Meta (já têm CPF, telefone e o operador da campanha) e envios do Inbox Meta.
- **Resposta do cliente (WHATSAPP, CPC)** — mensagens de entrada no Inbox Meta, uma por telefone/dia, ocorrência "Contato Com Cliente".
- **Exportação Mailing (ACAO)** — uma linha por CPF no momento em que a campanha/planilha é preparada, agente = quem criou a campanha.
- **Discagem Ativa (DISCADOR)** — ligações da 3C Plus; atendidas com qualificação de contato viram CPC, as demais ACAO, agente = agente da 3C.
- **Acordos e pagamentos (CONVERSAO)** — acordos lançados, quebras de acordo e parcelas marcadas como pagas no dia, agente = operador do acordo.
- **EMAIL e SMS** — as origens ficam previstas no gerador, mas hoje não há registro desses canais no sistema; só passam a sair quando existir a integração.

O casamento telefone → CPF usa o sufixo de 8 dígitos, padrão do projeto.

## Detalhes técnicos

- Nova função de banco `relatorio_ume_acionamentos(_data date)` que retorna as 9 colunas já normalizadas, unindo `envio_meta_job_item` + `envio_meta_job`, `meta_whatsapp_mensagens`, `meta_whatsapp_envios_log`, `tresc_ligacoes`, `acordos`/`pagamentos`, restringindo por `devedores.credor in ('ume_novo_mundo','ume_novo_mundo_aporte')`. `security definer`, acessível só a admin.
- Novo componente `src/components/relatorios/ArquivoDiarioUmeCard.tsx` chamando a RPC e montando o `.xlsx` no navegador com a lib `xlsx` já usada em `src/lib/exportExcel.ts` (carregamento lazy, sem novo pacote), incluindo a aba Dicionário.
- Geração sob demanda (o arquivo é montado na hora do clique), sem cron novo, sem armazenamento em bucket e sem polling — portanto **sem aumento de custo recorrente** no Lovable Cloud. Consultas são por faixa de data com os índices já existentes.
- Sem alteração de schema; a única mudança de banco é a função de leitura.
- Paginação interna por blocos ao ler a RPC para suportar dias com dezenas de milhares de linhas.

## Passo seguinte, se você quiser

Depois de validar os números com o credor, posso adicionar envio automático do arquivo (por WhatsApp/e-mail) num horário fixo — aí sim entra um cron, e eu apresento o alerta de custo antes.
