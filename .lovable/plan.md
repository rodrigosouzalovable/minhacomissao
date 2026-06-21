## Diagnóstico

**Botões não aparecem:** A função `meta-sync-templates` já foi atualizada para salvar `_components` (que inclui botões e rodapé), mas no banco a maioria dos templates ainda está com `variaveis` vazio — ou seja, a sincronização **não foi executada novamente** depois da última atualização. Basta re-sincronizar e os botões (SIM, BLOQUEAR CONTATO etc.) vão aparecer automaticamente no preview, tanto em "Templates HSM" quanto em "Envio em Massa".

**Imagens dos outros templates:** No banco só os 2 templates `atualizacao` têm `_header_format: IMAGE` configurado. Os outros (`autorizacao`, `recomendada`, `solicitacao`, `solicitacao_para_renegociar`, `solicitacao2`, `atualizacao_de_cadastro`, `vencimento_3_dias_antes`) estão sem header detectado — só vou saber quais têm imagem depois da re-sync.

## Plano

### Passo 1 — Você re-sincroniza (sem código)
Na aba **Templates HSM**, clique em **"Sincronizar Templates"** para cada instância Meta. Isso vai:
- Puxar os botões aprovados na Meta → aparecem no preview automaticamente
- Marcar quais templates têm `HEADER IMAGE` → eu identifico todos que precisam de imagem

### Passo 2 — Você me envia as imagens
Para cada template que tem foto na Meta, me envie:
- **Nome do template** (ex: `solicitacao2`, `recomendada`)
- **A imagem exata** que você cadastrou na Meta (anexa no chat)

A Meta exige que a imagem enviada seja **visualmente idêntica** ao sample aprovado, então é a mesma arte que você subiu lá.

Pode ser tudo de uma vez numa mensagem só, no formato:
```
- recomendada → [imagem A]
- solicitacao2 → [imagem B]  
- atualizacao (com botões) → [imagem do anexo 2 desta conversa]
```

### Passo 3 — Eu configuro (build mode)
Para cada template informado:
1. Faço upload da imagem via Lovable Assets (CDN)
2. Rodo migration atualizando `variaveis._header_image_url` no template correspondente
3. Confirmo que o preview do "Envio em Massa" mostra a imagem + botões certinhos

### Sobre botões — não precisa informar
Os botões já estão cadastrados na Meta e vêm automaticamente na sincronização. Não preciso saber quais templates têm botões — o componente `TemplateWhatsAppPreview` já renderiza qualquer botão (`QUICK_REPLY`, `URL`, `PHONE_NUMBER`) que vier do `_components`.

## Detalhes técnicos
- `meta-sync-templates/index.ts` já salva `_components` completo (linha 17) — só falta executar
- `TemplateWhatsAppPreview.tsx` já lê `template.variaveis._components` e renderiza header IMAGE/TEXT, body, footer e botões
- `send-whatsapp-meta` já valida `_header_image_url` antes de enviar e falha com mensagem clara se faltar
