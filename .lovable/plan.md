# Configurar Meta App ID

Inserir o App ID informado (`1041751302126373`) na tabela `meta_whatsapp_config` como chave `meta_app_id`. Isso libera o upload de mídia para os templates com cabeçalho Imagem/Vídeo/Documento.

SQL:

```sql
INSERT INTO public.meta_whatsapp_config (chave, valor)
VALUES ('meta_app_id', '1041751302126373')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();
```

Depois, na aba **Aplicar em Lote**, clicar em "Reenviar falhas" (ou selecionar as instâncias com FALHA_ENVIO novamente e clicar em "Enviar para Meta") — a chamada agora conseguirá fazer o upload da imagem e obter o `header_handle`.

Sem custo, sem novo código, sem migração de schema.
