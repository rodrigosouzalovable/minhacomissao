# Correção do rodízio de atendentes no Inbox Meta

## Diagnóstico (verificado)

A tabela `meta_atendimento_fila` tem 4 entradas (Anna Flavia, Yasmim, Fernanda, Wallace), mas todos os `etiqueta_id` apontam para IDs de etiquetas **que não existem mais** (foram apagadas na consolidação anterior de etiquetas). As etiquetas atuais têm IDs novos.

Como a trigger `atribuir_atendente_fila` insere em `meta_whatsapp_contato_etiquetas` usando o `etiqueta_id` da fila, todo insert do rodízio quebra por FK inválida (silencioso, capturado pelo `EXCEPTION WHEN OTHERS`). Ou seja, **o rodízio está 100% quebrado hoje**.

As etiquetas que você vê chegando para Fernanda/Wallace/Yasmim vêm de outro caminho: o auto-etiquetamento por **acordo existente** (bate telefone → acordo → atendente do acordo). Como Anna Flavia tem poucos/nenhum acordo antigo, ela nunca aparece por essa via — e o rodízio, que deveria cobrir esse caso, está quebrado.

## O que fazer

1. Atualizar as 4 linhas de `meta_atendimento_fila` para apontarem para os `etiqueta_id` atuais (Anna Flavia, Yasmim, Fernanda, Wallace), mantendo `ativo = true` e `ordem` 1–4.
2. Resetar `meta_atendimento_estado.ultimo_index` para 0, para o rodízio recomeçar limpo.
3. Verificar (SELECT) que o join `fila → etiquetas` agora retorna nome em todas as linhas.

Nenhuma mudança em código de frontend ou trigger — só reparo de dados em 4 linhas.

## Detalhes técnicos

```sql
-- 1) repointar fila para as etiquetas atuais
UPDATE meta_atendimento_fila SET etiqueta_id = 'bb51fdd6-2ca1-4abe-8200-bd08b8061d3f' WHERE ordem = 1; -- Anna Flavia
UPDATE meta_atendimento_fila SET etiqueta_id = '3946ebea-300a-4e72-93a1-be5e27d74ac8' WHERE ordem = 2; -- Yasmim
UPDATE meta_atendimento_fila SET etiqueta_id = '017ec7e0-9149-4dea-8764-bd1380a824eb' WHERE ordem = 3; -- Fernanda
UPDATE meta_atendimento_fila SET etiqueta_id = '151276d0-7bb2-4d51-8a7f-e6cb1c68046a' WHERE ordem = 4; -- Wallace

-- 2) reset do índice do round-robin
UPDATE meta_atendimento_estado SET ultimo_index = 0, atualizado_em = now() WHERE id = 1;
```

Após aplicar, novas conversas de entrada (sem etiqueta prévia e sem acordo antigo casando pelo telefone) começarão a ser distribuídas nas 4 atendentes na ordem Anna Flavia → Yasmim → Fernanda → Wallace, incluindo a Anna Flavia que hoje está fora.