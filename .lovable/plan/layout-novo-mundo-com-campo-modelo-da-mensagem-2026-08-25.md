# Layout Novo Mundo com campo "Modelo da mensagem"

Deixar a aba **Layout Novo Mundo** igual à **Layout UME**: um campo editável com o modelo da mensagem acima da mensagem gerada.

## O que muda

1. Novo bloco **Modelo da mensagem** na coluna direita, entre "Descontos" e "Mensagem gerada":
   - Textarea editável com o modelo atual (o mesmo que já é salvo por usuário e reaproveitado nos próximos atendimentos).
   - Linha de ajuda com as variáveis disponíveis: `{nome_usuario}`, `{nome_cliente}`, `{primeiro_nome}`, `{total_atraso}`, `{desconto_vista_pct}`, `{valor_quitacao}`, `{opcoes_parcelado}`.
   - Botão "Restaurar modelo padrão".
2. A edição do modelo continua salva automaticamente (mesmo comportamento já existente de salvamento com atraso), então ao voltar na aba o modelo editado aparece.
3. Ao colar a imagem e extrair os dados, a mensagem gerada já sai renderizada com o modelo editado e com os percentuais de desconto à vista e parcelado pré-definidos nos campos de Descontos (comportamento atual mantido e revisado para garantir que a mensagem atualiza imediatamente após a extração).

## Detalhes técnicos

- Arquivo único: `src/components/modelo-mensagem/ColarImagemTab.tsx`.
- O estado `template` já existe (carregado de `modelo_mensagem_template` e salvo com debounce); hoje ele só não é exposto na UI — basta renderizar o Textarea ligado a esse estado, seguindo o padrão de `LayoutUmeTab.tsx`.
- Restaurar padrão usa a constante `TEMPLATE_PADRAO` já exportada do próprio arquivo.
- Nenhuma mudança de banco de dados nem de backend.
