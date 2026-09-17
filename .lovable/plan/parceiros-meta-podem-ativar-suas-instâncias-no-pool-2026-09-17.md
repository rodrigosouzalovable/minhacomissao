# Parceiros Meta podem ativar suas instâncias no pool

Liberar o botão **“Ativar no pool”** para todo usuário com a tag **Parceiro Meta**, limitado exclusivamente às instâncias vinculadas à própria conta.

## O que será feito

1. **Botão disponível para parceiros**
   - Exibir **“Ativar no pool”** e **“Retomar”** nas instâncias próprias que estejam aguardando, pausadas ou restritas.
   - Depois da ativação, a instância poderá ser marcada para a campanha e os templates aprovados dela serão carregados, liberando o fluxo de importação da planilha.
   - Manter visíveis os avisos de qualidade, nome e restrições; uma recusa real da Meta continuará aparecendo normalmente.

2. **Proteção por propriedade**
   - Criar uma ação segura no banco que aceite administradores ou Parceiros Meta.
   - O parceiro só poderá ativar uma instância vinculada a ele em `meta_instance_parceiros`; não poderá informar o código de uma instância de outro usuário para ativá-la.
   - Administradores continuam podendo ativar qualquer instância.

3. **Retenção manual preservada**
   - Instâncias marcadas como **“Fora do pool manualmente”** continuarão exigindo retorno pelo administrador, conforme a regra já definida.
   - A nova permissão cobre ativação inicial e retomada; não permite ao parceiro desfazer uma retirada manual administrativa.

4. **Validação do fluxo completo**
   - Testar com perfil Parceiro Meta: abrir Instâncias, ativar/retomar número próprio, selecioná-lo, escolher template aprovado e abrir a importação da planilha.
   - Confirmar que outro parceiro não consegue ativar números sem vínculo e que o comportamento do administrador permanece igual.

## Detalhes técnicos

- Ajustar `src/pages/EnvioMeta.tsx` para mostrar a ação quando `isAdmin || parceiroMeta` e usar a nova operação protegida.
- Adicionar migração com função `SECURITY DEFINER`, validação de sessão, tag Parceiro Meta e vínculo da instância antes de atualizar o pool.
- A ativação limpa a pausa, define o pool como ativo e inicia/retoma a rampa existente; não altera templates nem mascara respostas da Meta.
- Sem novo agendamento, repetição automática ou consulta periódica: **sem aumento relevante de custo no Cloud**.
