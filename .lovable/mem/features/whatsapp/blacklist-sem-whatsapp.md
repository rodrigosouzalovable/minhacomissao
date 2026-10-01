---
name: Blacklist de números sem WhatsApp
description: Números brasileiros confirmados sem WhatsApp são bloqueados permanentemente e removidos das próximas listas antes de nova validação
type: feature
---

- Ao usar **Validar agora** no Envio Meta, somente respostas definitivas da UAZAPI entram na categoria `sem_whatsapp`.
- Erros, timeouts, formatos inválidos e resultados inconclusivos nunca entram nessa blacklist.
- Em novas importações, os números são comparados pelos últimos 8 dígitos e removidos antes de nova validação.
- O bloqueio é obrigatório e independente da chave **Bloquear Blacklist**, que continua controlando pedidos de descadastro.
- Motivos anteriores mais fortes não são sobrescritos; administradores podem localizar e reativar o número na tela Blacklist.