# Envio Meta: remover validação de WhatsApp e mostrar "Carregando" no Disparar

## O que muda na tela
1. **Sai o bloco de validação de WhatsApp**: some o interruptor "Validar WhatsApp durante o disparo", a linha de números UAZAPI para validação, o botão "Validar agora (opcional)", o botão de baixar Excel da validação e o resumo dela.
2. **Sem a validação, o disparo não checa mais o WhatsApp de cada contato antes de enviar** (hoje vem ligado por padrão). A mensagem de confirmação para de falar dessa checagem.
3. **Botão "Disparar" com carregamento na hora**: ao clicar, o botão já mostra o círculo girando e o texto "Carregando...", e não pode ser clicado de novo. Depois mostra "Revalidando instâncias na Meta..." como hoje. Se aparecer a janela de confirmação, ou se o envio for cancelado ou der erro, o botão volta ao normal. O mesmo vale para "Agendar".

## Detalhes técnicos
- `src/pages/EnvioMeta.tsx`: remover o bloco da validação (cerca das linhas 2593–2700) e os estados e funções que ficarem sem uso (`validarAgora`, `validacaoPreview`, `validando`, conexões UAZAPI, se não forem usados em outro lugar).
- `validarNoEnvio` fixo em `false` na criação da campanha. Nada muda no servidor.
- Novo estado `preparandoDisparo`: ligado no início de `enviar()` e desligado em `finally` e antes de abrir a confirmação. O botão fica bloqueado e mostra o círculo girando enquanto `preparandoDisparo || iniciandoCampanha` estiver ligado.
