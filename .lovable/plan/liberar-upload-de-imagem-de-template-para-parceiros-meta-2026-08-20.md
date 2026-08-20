# Liberar upload de imagem de template para parceiros Meta

## O problema

O erro "new row violates row-level security policy" acontece no **upload do arquivo para o storage**, não no template em si.

As imagens de template são gravadas na pasta `meta-templates/...` do bucket `inbox-media`. As regras de leitura, atualização e exclusão desse bucket já aceitam a pasta `meta-templates`, mas a regra de **inserção (upload)** não — ela só libera admin ou pastas com ID de instância. Por isso o Thiago Nogueira (parceiro Meta, não admin) é bloqueado ao enviar a foto, e apenas o login admin consegue.

## Correção

Ajustar a política de upload do bucket `inbox-media` para também aceitar as pastas já autorizadas nas outras operações: `meta-templates`, `quick-replies` e `meta`, mantendo o resto igual (admin e pastas de instância própria).

Depois disso o parceiro consegue enviar a imagem pelo botão "Enviar imagem do meu computador" e ela é salva nos registros do template das instâncias que ele pode ver (essa parte já é permitida pelas regras de template do parceiro).

## Detalhes técnicos

- Migração: recriar a policy `Auth upload inbox-media` (INSERT em `storage.objects`, role `authenticated`) adicionando ao `WITH CHECK` a condição `(storage.foldername(name))[1] = ANY (ARRAY['meta-templates','quick-replies','meta'])`, alinhando com as policies de SELECT/UPDATE/DELETE existentes.
- Nenhuma alteração de front-end necessária: `uploadInboxMedia` e `TemplatePreviewDialog` já usam o caminho `meta-templates/{template_id}/...` e geram URL assinada.

## Fora do escopo

Não muda visibilidade de mídia de conversas, nem torna o bucket público, nem altera permissões de instâncias/parceiros.
