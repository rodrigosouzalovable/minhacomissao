# Corrigir envio de arquivos pelo Bruno no Inbox Meta Oficial

## Diagnóstico confirmado
- Na conversa com André, Bruno já consegue gravar o PDF em `inbox-media`; há arquivos PDF dessa conversa com Bruno como proprietário. A checagem de autorização por conversa também retorna `true` no login dele.
- O passo seguinte falha: no mesmo login, pedir a URL assinada do PDF já gravado retorna `Object not found`. A política de leitura de `inbox-media` não usa a mesma validação de conversa permitida no upload e depende do proprietário da instância ou de um acesso genérico à caixa. A listagem da pasta ainda produz erro ao interpretar um telefone como UUID.
- O aviso “instância ou template não encontrado” é genérico e enganoso para esse caso: arquivos não usam template. Há registro de um envio de documento aceito pela Meta às 20h15, mas o PDF do relato também foi gravado em outras tentativas; não é seguro concluir que todas foram enviadas.

## Mudanças
1. Alinhar a permissão de **leitura e geração de URL assinada** dos anexos do Inbox com a permissão existente de acesso à conversa: instância e telefone/BSUID devem corresponder a uma conversa visível ao usuário. Bruno poderá acessar arquivos apenas nas caixas autorizadas, mesmo sem ser o proprietário da instância.
2. Preservar os caminhos legados e acessos atuais para administradores globais, donos das instâncias e mídias operacionais; evitar conversão de telefone em UUID nos caminhos de arquivos de conversa.
3. No envio de arquivo, distinguir falha ao salvar/assinar o anexo de falha do envio pela Meta. Trocar a mensagem genérica de “instância ou template” por orientação adequada quando a URL do arquivo não puder ser gerada.

## Validação
- Como Bruno, gerar uma URL assinada e baixar um PDF de conversa autorizada; conferir que o link responde com o arquivo esperado. Repetir com áudio e outras mídias cobertas pela mesma regra.
- Confirmar que um usuário sem acesso à caixa não consegue gerar URL de anexo dessa conversa; preservar acesso aos arquivos próprios de outras caixas.
- Conferir o fluxo de confirmação e seus erros sem reenviar o PDF nem mandar qualquer mensagem real ao cliente durante os testes.

## Detalhes técnicos
- Migração pontual na política `SELECT` do bucket privado `inbox-media`, aproveitando a função de autorização por conversa já existente, com escopo por instância/destinatário; não tornar o bucket público.
- Ajustes localizados no tratamento do erro de `uploadInboxMedia` e em `humanizarErroEnvio`, sem rotina periódica ou novos serviços.
