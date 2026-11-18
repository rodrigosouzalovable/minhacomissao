# Tradução nas conversas da caixa USA B2B

## O que você verá
Somente quando a conversa aberta pertencer à caixa **USA B2B** no Inbox Meta Oficial:

1. **Botão "Traduzir conversa"** no topo da conversa: mostra, abaixo de cada mensagem do cliente e do IAGO, a tradução em português. Clicar de novo oculta. As traduções ficam guardadas na tela enquanto a conversa estiver aberta (não traduz de novo a cada clique).
2. **Reescrever resposta**: no campo de mensagem, você digita em português e clica em **"Inglês"** ou **"Espanhol"**. O texto do campo é substituído pela versão traduzida, em tom comercial e natural; você revisa e envia normalmente. Nada é enviado automaticamente.

Outras caixas não mudam.

## Custo
Uso de IA apenas quando você clica (sem rotina automática, sem verificação periódica). Estimativa: centavos por conversa traduzida.

## Detalhes técnicos
- Nova função de backend `traduzir-texto` (autenticada, exige usuário da equipe) usando o gateway de IA com o modelo padrão; recebe `{ modo: "para_pt" | "para_en" | "para_es", textos: string[] }` e devolve as traduções em lote.
- `MetaComposer.tsx`: botões Inglês/Espanhol visíveis só quando a pasta da conversa é USA B2B; desabilitados com campo vazio ou durante a tradução; preserva o rascunho em caso de erro.
- Tela da conversa Meta: botão "Traduzir conversa" com cache em memória por mensagem; traduz as últimas mensagens de texto carregadas.
- Sem alterações no banco de dados.
