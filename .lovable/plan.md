## Problema

O botão "Sincronizar Templates" hoje fica em cada card da aba **Instâncias** (botão pequeno com ícone RefreshCw). Na aba **Templates HSM** não existe nenhum botão de re-sincronizar, então o usuário não consegue puxar botões/headers atualizados de lá.

## Plano

Adicionar um botão **"Sincronizar todos os templates"** no topo da aba "Templates HSM" em `src/pages/ConfigurarMeta.tsx`. Ele percorre todas as instâncias ativas chamando a função existente `meta-sync-templates` (uma por uma), mostra loader durante o processo e recarrega a tabela ao final. Também mostra toast com total sincronizado.

Sem mudança em edge functions — só UI. Depois que o usuário clicar e a sync rodar, os botões SIM/BLOQUEAR CONTATO e o `_header_format: IMAGE` do template `recomendada` (e outros) entram no banco, e o preview de "Envio em Massa" passa a mostrar tudo automaticamente.

Em paralelo, depois do sync, eu rodo uma query para listar quais templates ficaram com `_header_format: IMAGE` e te peço a imagem de cada um (mesma arte que você cadastrou na Meta).
