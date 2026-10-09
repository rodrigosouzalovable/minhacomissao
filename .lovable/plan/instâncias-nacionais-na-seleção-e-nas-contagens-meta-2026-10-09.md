# Instâncias nacionais na seleção e nas contagens Meta

## 1. Envio Meta — impedir seleção de internacionais
- **Selecionar todas** incluirá somente números brasileiros, mesmo com filtros de BM ou qualidade ativos.
- Conforme sua confirmação, a seleção individual de números internacionais também ficará desabilitada.
- Remover internacionais de seleções antigas carregadas na tela e validar novamente antes de iniciar ou agendar um novo disparo, para que não permaneçam selecionados por um estado anterior.
- Manter as regras atuais de qualidade para números nacionais: sem filtro, seleção em massa de GREEN/UNKNOWN/sem leitura; com filtro explícito, selecionar os nacionais elegíveis daquele filtro.
- Preservar os cadastros internacionais e sua utilização na caixa AQUECIMENTO. Marcar ou desmarcar não alterará o pool.

## 2. API Oficial Meta — contar somente nacionais
- Ajustar o contador da aba **Instâncias** e as quantidades de instâncias junto às BMs, inclusive **Sem BM vinculada**, para considerar apenas números brasileiros.
- Respeitar os filtros e as permissões de visualização existentes.
- Manter os cartões dos internacionais disponíveis para consulta e administração, mas sem incluí-los nessas contagens.
- Números brasileiros de teste continuam na contagem: a exclusão será pelo país do telefone, não pelo nome TESTE.
- Não modificar limites de BM, consumo, quantidades de templates, verificações ou histórico de campanhas.

## Detalhes técnicos
- Hoje, `EnvioMeta.tsx` não restringe a seleção pelo país e permite marcação individual de qualquer instância exibida. `ConfigurarMeta.tsx` utiliza o tamanho das listas para contar instâncias, incluindo internacionais.
- Centralizar a identificação do telefone brasileiro para que seleção e contagens usem a mesma regra. Considerar DDI +55 e formato brasileiro válido; reconhecer formatos com `+`, `00` e apenas dígitos. Não inferir o país pelo nome da instância nem utilizar Phone Number ID como telefone.
- Telefones ausentes ou ambíguos não serão tratados como brasileiros até serem identificados corretamente.
- Alteração na interface, sem novos agendamentos, consultas recorrentes ou mudanças de permissões. Não alterar campanhas já em execução.

## Validação
- Testar brasileiros com e sem formatação, internacionais `+1 555…` e outros DDIs, números ausentes e entradas inválidas.
- Confirmar que internacionais não entram por seleção em massa, seleção manual ou seleção antiga restaurada.
- Confirmar seleção de nacionais com filtros GREEN, RED/YELLOW e BM, preservando as regras atuais.
- Conferir contagem geral e por BM com listas mistas; brasileiros de teste contam e internacionais não.
- Verificar a tela e os testes sem enviar mensagens reais.