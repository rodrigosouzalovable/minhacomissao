# Corrigir envio de PDF pelo Bruno no Inbox Meta

## Diagnóstico confirmado

- O erro acontece antes do envio à Meta, no upload do PDF para o armazenamento privado `inbox-media`.
- A conversa **luis fernando giffhorn** está na instância **AMARAL 62 8277-3441**, dentro da caixa **ODRES-Confirmação**.
- Bruno está cadastrado como administrador dessa caixa e consegue acessar a conversa, mas a instância pertence a outro usuário.
- A regra atual do armazenamento valida a instância pelo vínculo direto do parceiro. Para Bruno, essa validação não reconhece o acesso concedido pela caixa, embora a regra da conversa reconheça. Por isso o upload é recusado com `new row violates row-level security policy`.

## Alterações

1. **Alinhar o upload com o acesso à conversa**
   - Criar uma validação segura para permitir upload em `inbox-media` quando o usuário autenticado realmente puder acessar a conversa indicada no caminho do arquivo.
   - Manter válidos os acessos atuais de administradores, proprietários de instância e pastas especiais já autorizadas.
   - Não tornar o bucket público e não liberar acesso geral a arquivos de outras caixas.

2. **Restringir ao destinatário correto**
   - Conferir a instância e o telefone/BSUID presentes no caminho do arquivo contra um contato acessível ao usuário.
   - Preservar a comparação por sufixo telefônico usada no sistema, para não falhar por variações com DDI ou nono dígito.

3. **Melhorar a mensagem de falha**
   - Quando o armazenamento negar o upload, mostrar uma orientação clara de falta de acesso à conversa, em vez do texto técnico da política.

4. **Validar sem enviar ao cliente**
   - Testar a autorização com o mesmo cenário do Bruno e confirmar que um PDF pode ser armazenado e receber URL assinada.
   - Confirmar que um usuário sem acesso à caixa continua bloqueado.
   - Verificar imagem, áudio, vídeo e PDF, pois todos usam o mesmo envio de mídia.
   - Não disparar arquivo real para o WhatsApp durante o teste.

## Detalhes técnicos

- Nova migração para uma função `SECURITY DEFINER` de autorização por instância + contato e ajuste da policy `Auth upload inbox-media`.
- `src/lib/humanizarErroEnvio.ts`: tradução específica do erro de permissão do upload.
- Sem cron, polling, tabela nova ou aumento relevante de custo de Cloud.
