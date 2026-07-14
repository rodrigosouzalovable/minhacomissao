## Contexto

No dialog de detalhe da campanha (`CampanhaDetalheDialog.tsx`) hoje aparecem os badges de entrega (Aceito / Entregue / Lida / Falhou) e listas separadas de "Enviados" e "Erros". Só que:

- A lista **Erros** só mostra envios que **nem saíram** da API (falha imediata no disparo).
- Os "**Falhou: 13**" que você vê vêm de outra coisa: mensagens que **foram aceitas pela API**, mas depois o WhatsApp retornou falha de entrega (número inválido, bloqueado, etc.). Esses casos ficam guardados dentro da lista de "Enviados" com `deliveryStatus = failed`, e por isso não aparecem em nenhum lugar visível.

Além disso, os rótulos Aceito / Entregue não têm explicação nenhuma na tela.

## O que vou mudar (só UI, sem mexer em backend)

**Arquivo:** `src/components/meta/CampanhaDetalheDialog.tsx`

### 1. Nova seção "Falharam na entrega"

Adicionar, logo abaixo da seção "Erros", uma nova seção `<details>` (colapsável, aberta por padrão quando tiver itens) chamada **"Falharam na entrega"**, listando os itens de `detalhes.enviados` onde `deliveryStatus` é `failed` ou `falhou`.

Cada linha mostra:
- Telefone
- Instância usada
- Motivo (`deliveryErro`) quando disponível — em vermelho, igual à seção Erros

Ações no cabeçalho: **Copiar** e **Baixar Excel** (reaproveitando o mesmo padrão das outras seções — colunas Telefone, Instância, Erro entrega).

Contagem no título alinha com o badge "Falhou: N".

### 2. Legenda dos status de entrega

Ao lado da linha de badges (Aceito / Entregue / Lida / Falhou / Aguardando), adicionar um pequeno ícone de ajuda (`HelpCircle`) com `Tooltip` do shadcn explicando cada status:

- **Aceito** — o WhatsApp recebeu a mensagem do nosso lado (1 tique). Ainda não foi entregue ao aparelho do destinatário.
- **Entregue** — chegou no aparelho do destinatário (2 tiques cinza).
- **Lida** — o destinatário abriu a conversa e viu a mensagem (2 tiques azuis).
- **Falhou** — o WhatsApp devolveu falha na entrega (ex.: número não existe, número bloqueou, conta banida).
- **Aguardando** — ainda não recebemos confirmação de entrega.

### 3. Nada mais muda

- Lista "Enviados" continua igual.
- Lista "Erros" continua igual (falhas de disparo imediatas).
- Nenhuma edge function, tabela ou lógica de negócio é tocada.

## Como fica para você

Quando abrir a campanha do CSIM Novo Mundo, além do "Enviados (34)" você vai ver **"Falharam na entrega (13)"** com o telefone, instância e o motivo devolvido pelo WhatsApp para cada um — dá para copiar/exportar em Excel e entender por que falharam. E o `?` ao lado dos badges explica o que Aceito e Entregue significam.