# Corrigir envio de áudio no Inbox Meta Oficial

## Diagnóstico confirmado

- O áudio mais recente, às 11:11, foi convertido em MP3, enviado à Meta e aceito normalmente.
- O armazenamento contém dois formatos ainda usados pelos navegadores:
  - atual: `instância/destinatário/arquivo.mp3`;
  - anterior: `meta/instância/destinatário/arquivo.mp3`.
- A proteção recém-adicionada ao envio reconhece somente o formato atual. Quando um navegador ainda carregado com a versão anterior grava em `meta/...`, a função interpreta `meta` como se fosse a instância e devolve exatamente **“O arquivo não corresponde à conversa selecionada”**, antes do upload à Meta.
- A mesma incompatibilidade existe na validação de permissão do arquivo, que também espera a instância na primeira parte do caminho.

## Correção

1. **Aceitar os dois formatos com segurança**
   - Normalizar o caminho dentro da função de envio: quando começar por `meta/`, usar as partes seguintes como instância e destinatário; no formato atual, manter a leitura existente.
   - Continuar exigindo correspondência da instância e do destinatário da conversa, inclusive pela regra dos últimos oito dígitos.

2. **Alinhar a autorização do armazenamento**
   - Atualizar a verificação autenticada da conversa para entender os dois formatos.
   - Manter bloqueados arquivos de outra instância, outro destinatário ou conversa sem acesso para o usuário.

3. **Evitar novas divergências**
   - Centralizar a interpretação do caminho no envio e registrar somente o formato identificado e o motivo de uma recusa, sem telefone, áudio ou credenciais.
   - Manter o formato atual para novas gravações; a compatibilidade anterior serve aos usuários que ainda estão com a página antiga aberta ou em cache.

4. **Validar sem enviar mensagem real**
   - Testar os dois formatos contra uma conversa acessível, interrompendo antes do envio à Meta.
   - Testar caminhos de outra instância e outro destinatário para confirmar que continuam recusados.
   - Verificar gravação, conversão para MP3, autorização e resposta da função; conferir a versão desktop e móvel e o estado final da aplicação.

## Impacto

- Não cria rotina automática, consulta recorrente ou novos envios.
- Não altera a janela de 24 horas nem as permissões das caixas.
- Não há aumento relevante de custo de Cloud.
