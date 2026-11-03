# Etiqueta do Rodrigo nunca é trocada por outro atendente

## O que acontece hoje
- A conversa da Maria Fernanda (+55 83 99341-8781) está agora com a etiqueta "Atendente: RODRIGO RIBEIRO DE SOUZA" (colocada às 20:16).
- Quando outro atendente manda mensagem pela conversa (texto começando com "*Atendente FULANO:*" ou pelo próprio login), o sistema **troca** a etiqueta de atendente pela de quem enviou. Assim a conversa à vista do portal foi parar na Ana Flávia.

## O que vai mudar
1. **Etiqueta do Rodrigo é definitiva:** se a conversa já tem "Atendente: RODRIGO RIBEIRO DE SOUZA", nenhum envio automático, rodízio, IAGO, Clara ou mensagem de outro atendente troca essa etiqueta. Só você pode retirá-la manualmente.
2. **Acordos à vista do portal:** continuam recebendo automaticamente a etiqueta do Rodrigo (na confirmação e quando o cliente escreve), e passam a ficar protegidos pela regra acima.
3. **Proteção também no banco:** se qualquer rotina tentar apagar a etiqueta do Rodrigo de uma conversa ou colocar outra etiqueta de atendente junto, a operação é ignorada — exceto quando feita pelo seu login de admin.
4. Os demais atendentes continuam etiquetando normalmente as conversas que não são suas.

## Detalhes técnicos
- `_shared/etiqueta-atendente.ts`: antes de remover/inserir, se o contato já possui `ETIQUETA_RODRIGO_ID`, retorna `{ ok:false, motivo:'protegida_rodrigo' }` (vale para `send-whatsapp-meta-text` e `send-whatsapp-meta-handler`).
- Revisar `atribuir_atendente_rodizio` / `atribuir_atendente_conversa` e o IAGO para respeitar a mesma proteção.
- Trigger em `meta_whatsapp_contato_etiquetas`: bloqueia DELETE da etiqueta do Rodrigo e INSERT de outra "Atendente:" quando o contato já tem a do Rodrigo, salvo `auth.uid()` = admin Rodrigo.
- Teste unitário da regra de proteção.
