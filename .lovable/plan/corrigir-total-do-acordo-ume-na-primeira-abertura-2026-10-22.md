## Corrigir total do acordo UME na primeira abertura

**Problema:** ao abrir a janela pela primeira vez, o total da mensagem (ex.: R$ 2.092,20) é preenchido, mas logo em seguida a consulta à UME substitui pelo total em aberto (R$ 1.902,38). Na segunda abertura funciona porque o campo já estava preenchido.

**Correção (AcordoUmeApiDialog):**
- Ao abrir, passar para a consulta o total da proposta da mensagem.
- A consulta só usa o total em aberto quando não houver proposta na mensagem e o campo estiver vazio (verificação pelo valor atual, não pelo valor antigo da tela).
- Nada muda na simulação, efetivação ou boleto.

**Verificação:** abrir uma conversa com proposta e conferir que o total aparece certo já no primeiro clique.
