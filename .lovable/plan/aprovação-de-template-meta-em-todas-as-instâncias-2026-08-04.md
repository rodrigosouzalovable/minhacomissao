# Aprovação de template Meta em todas as instâncias

## O que os dados mostram

O template `condicao_de_renegociacao` (UTILITY, pt_BR, cabeçalho IMAGE, 2 botões QUICK_REPLY) foi enviado para 25 instâncias:

- 23 estão `REJECTED`
- 2 ficaram `FALHA_ENVIO` com o erro `resumable start falhou: API access blocked` (upload da imagem do cabeçalho barrado no App ID da BM daquelas instâncias)
- **nenhuma delas tem `motivo_rejeicao` gravado** — ou seja, o motivo real da Meta ainda não foi capturado pelo sistema

Também há um histórico: `boleto_novo_mundo_2` e `negociacao_disponivel` seguiram o mesmo caminho, enquanto os templates aprovados (`agende_a_videoconferncia`, `dados_validados_com_sucesso`) têm uma diferença objetiva no cadastro: eles possuem **exemplos de variável preenchidos** (`exemplo.body_text`). Nos rejeitados o campo `exemplo` está vazio `{}` — o payload sobe com `{{name}}` sem `example`, o que a Meta trata como template incompleto e é uma das causas clássicas de rejeição/reclassificação.

A segunda hipótese forte é conteúdo: "as condições para renegociação estão disponíveis, clique abaixo e consulte" é lido pela Meta como oferta/promoção, não como utilidade sobre uma transação existente — o que gera rejeição por categoria incorreta.

Como o motivo oficial não está gravado, o plano começa confirmando isso na API antes de mudar o texto.

## Plano

### 1. Descobrir o motivo real (primeiro passo, antes de qualquer reescrita)
Corrigir a captura de motivo em `meta-verificar-status-templates`: hoje ela só busca detalhe quando `status = REJECTED AND motivo_rejeicao IS NULL`, mas os 23 registros já estão nesse estado e continuam sem motivo — o filtro `.or(...)` combinado não está retornando os registros esperados. Ajustar a consulta e adicionar os campos `rejected_reason` e `quality_score` do endpoint individual, guardando também o corpo bruto do erro. Rodar uma vez e exibir o motivo por instância na aba Status.

### 2. Pré-voo obrigatório antes de submeter
Bloquear o envio em lote quando o template tiver problemas que garantem rejeição:
- variável `{{name}}` / `{{1}}` sem valor de exemplo → campo de exemplo passa a ser obrigatório no formulário e é enviado em `components.BODY.example.body_text`
- cabeçalho de mídia sem imagem carregada
- botão URL sem exemplo
- checagem de linguagem promocional no corpo (palavras como "condições", "oferta", "aproveite", "disponível para consulta") com aviso de risco de rejeição por categoria

### 3. Estratégia de aprovação em duas etapas (piloto → replicação)
Em vez de disparar para as 25 BMs de uma vez e queimar todas com a mesma rejeição:
1. **Piloto**: submeter em 1 instância escolhida e aguardar o veredito da Meta (o verificador de status já roda periodicamente).
2. **Replicar**: só após `APPROVED` no piloto, liberar o botão "Replicar nas demais" que envia o mesmo payload, exatamente igual, para as outras instâncias.

Isso passa a ser o fluxo padrão da aba "Aplicar em Lote", com opção de forçar o envio direto para todas (para quem já tem o texto validado).

### 4. Corrigir o `API access blocked` das 2 instâncias
O upload de mídia usa o App ID da BM da instância. Nas duas que falharam, o App não tem acesso à Resumable Upload API. Ajustes:
- fallback: se o App ID da BM falhar, tentar o App ID da BM padrão
- mensagem clara na UI apontando qual BM/App precisa de ajuste, em vez do erro cru

### 5. Reenvio limpo do template atual
Depois de corrigido o cadastro (exemplo da variável + texto revisado com base no motivo real), submeter uma nova versão pelo fluxo piloto → replicação. Templates rejeitados podem ser reenviados com o mesmo nome; se a Meta bloquear o nome, o sistema sugere sufixo de versão (`_v2`).

## Detalhes técnicos

- `supabase/functions/meta-verificar-status-templates/index.ts`: corrigir filtro de seleção, gravar `rejected_reason` + detalhe individual, novo campo de log do payload de erro.
- `supabase/functions/meta-criar-template-lote/index.ts`: validação de payload antes do POST; fallback de App ID no `obterHeaderHandle`; suporte a modo `piloto` (1 instância) e `replicar` (demais, apenas se piloto aprovado).
- `src/pages/MetaTemplates.tsx`: exemplo de variável obrigatório, checklist de pré-voo, novo fluxo piloto/replicar na aba "Aplicar em Lote", exibição de `motivo_rejeicao` por instância na aba Status.
- Sem mudanças em envio de campanhas, custos ou round-robin.

## Fora do escopo

Nenhuma alteração no motor de disparo em massa nem nas travas de custo.
