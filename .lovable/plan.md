# Liberar imagens de templates Meta para parceiros autorizados

## Diagnóstico confirmado

O usuário Thiago Nogueira está ativo, possui acesso à aba Templates Meta e é reconhecido como parceiro Meta. Ele já consegue criar registros próprios de template.

O bloqueio ocorre antes do salvamento: a tela envia a amostra da imagem para o espaço privado `meta-template-media`, cuja regra atual permite upload somente para administradores e gestores. Como Thiago tem perfil de funcionário parceiro, o envio é rejeitado pela segurança do banco.

## Correção

1. Organizar novos arquivos de template em uma pasta individual do usuário autenticado.
2. Ajustar as permissões do espaço privado para permitir que parceiros Meta:
   - enviem arquivos apenas na própria pasta;
   - leiam, atualizem e removam somente arquivos próprios;
   - não acessem arquivos de outros parceiros.
3. Preservar o acesso atual de administradores e gestores e manter o espaço privado, com links temporários para a Meta processar a mídia.
4. Manter a criação do template vinculada ao usuário que o cadastrou; nenhuma permissão comercial ou de instância será ampliada.
5. Melhorar a mensagem exibida quando o envio da imagem falhar, distinguindo falha de permissão, formato e tamanho.

## Validação

- Testar com o acesso autorizado do Thiago: anexar imagem, salvar o template e confirmar que ele aparece em “Aplicar em lote”.
- Confirmar que um parceiro não consegue ler, substituir ou excluir a imagem de outro usuário.
- Confirmar que admin e gestor continuam operando normalmente.
- Validar a tela e o estado final sem erros.

## Impacto

Não cria automações, consultas recorrentes ou novos processos. Portanto, não aumenta o consumo contínuo do Lovable Cloud.
