# CPF da planilha no cabeçalho da conversa

## O que aconteceu

A campanha que está rodando agora (1.710 contatos) foi criada **sem o CPF**: todos os 1.710 itens do disparo estão com o campo CPF vazio, e por isso os contatos criados no Inbox (Ivanda, Maria, etc.) também estão sem CPF — nada aparece no cabeçalho.

O motivo: na planilha `UME_NOVO_MUNDO_1.xlsx` não existe linha de cabeçalho e os CPFs da coluna C vêm sem os zeros à esquerda (`7144296`, `25827243`, `30980100`). A detecção automática de coluna só reconhece documento quando os valores têm 11 ou 14 dígitos, então a coluna C não foi identificada como "CPF / CNPJ" e acabou ignorada na importação. Confirmado na base: `00030980100` e `00025827243` são CPFs reais da carteira UME Novo Mundo.

## Correções

### 1. Reconhecer CPF curto na importação (evita o problema de novo)

No diálogo de mapeamento de colunas:

- A detecção automática passa a marcar como **CPF / CNPJ** colunas numéricas com 7 a 11 dígitos (além das de 11/14), desde que não sejam a coluna de telefone (telefones brasileiros têm 10-13 dígitos e DDD válido).
- Ao confirmar, se sobrar alguma coluna ignorada que pareça documento (7-11 dígitos puros), aparece um aviso pedindo para marcá-la como "CPF / CNPJ" antes de continuar — mesmo comportamento que já existe hoje para a coluna de nome.
- Os valores continuam sendo completados com zeros à esquerda até 11 dígitos (CPF) ou 14 (CNPJ), como já é feito.

### 2. Corrigir a campanha que está rodando agora

Vinculação em massa, a partir da própria planilha enviada:

- Preencher o CPF nos 1.710 itens da campanha em execução (telefone → CPF da planilha), para que todo envio que ainda falta já grave o CPF no contato.
- Preencher o CPF nos contatos do Inbox que já receberam mensagem dessa campanha (sem sobrescrever CPF já existente).
- Registrar os pares telefone → CPF na base de vínculo (`acionamento_telefone_cpf`), que é a mesma usada pelo cabeçalho como segunda fonte e pelos relatórios UME.

Depois disso o cabeçalho passa a mostrar `CPF 000.309.801-00` ao lado do nome/telefone, junto do selo do credor, exatamente como no exemplo enviado.

## Detalhes técnicos

- `src/components/meta/MapearColunasImportDialog.tsx`: ampliar `columnLooksLikeDocument`/`detectRole` para faixa de 7-11 dígitos com guarda anti-telefone; validação extra em `confirmar()`.
- Correção de dados via `run_sql`: `UPDATE envio_meta_job_item` e `UPDATE meta_whatsapp_contatos` casando pelo sufixo de 8 dígitos do telefone (padrão do projeto), mais `acionamento_vincular_telefone_cpf`.
- Nenhuma mudança de schema, cron, polling ou realtime — custo de backend inalterado.
