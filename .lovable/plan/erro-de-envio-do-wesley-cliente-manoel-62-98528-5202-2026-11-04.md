# Erro de envio do Wesley (cliente Manoel, (62) 98528-5202)

## Causa confirmada
- A conversa está ligada ao número **AMARAL 62 8281-9437** (do Thiago Nogueira), que está **desativado** no sistema.
- O sistema recusa envios por números desativados. A mensagem não chegou ao cliente nem foi salva.
- O aviso vermelho genérico ("non-2xx") aparece porque a versão publicada ainda não tem a melhoria de avisos que já está no preview. Com ela, o Wesley veria "instância desativada".

## O que fazer
1. Publicar o app para que todos vejam o motivo real do erro, e não o aviso genérico.
2. Liberar o envio para esse cliente, por um destes caminhos (sua escolha):
   - **A)** Reativar o número AMARAL 62 8281-9437, se ele foi desligado por engano (o Thiago confirma).
   - **B)** Deixar o número desligado: o Wesley responde o cliente por outro número ativo da caixa. Quando o cliente responder, a conversa nova fica nesse número.
3. Checar quantas conversas abertas ainda estão presas em números desativados e listar para você.

## Detalhes técnicos
- `meta_whatsapp_instances.id = 8242c450…` com `ativo=false`; `send-whatsapp-meta-text` retorna 404 "Instância Meta não encontrada/ativa".
- Nenhuma regra de envio será afrouxada: números desativados continuam bloqueados.
