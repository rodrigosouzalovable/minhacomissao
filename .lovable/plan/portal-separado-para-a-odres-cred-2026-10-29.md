# Portal separado para a Odres Cred

## O que muda para o cliente

**Portal principal — meusacordos.com.br (e /novomundo, /ume)**
- A tela de busca mostra somente as logos e os textos de **Novo Mundo** e **UME**.
- Ao pesquisar o CPF, o resultado consulta e mostra apenas as dívidas e os acordos de Novo Mundo e UME. Nada da Odres Cred aparece, nem mesmo como "carteira consultada".
- O rodapé passa a dizer "Atendimento para Novo Mundo e UME".

**Novo portal — meusacordos.com.br/odrescred**
- Tela de busca própria, só com a logo e os textos da **Odres Cred**, sem citar UME nem Novo Mundo.
- O resultado consulta e mostra somente a carteira Odres Cred, com as mesmas regras de hoje (à vista, parcelado, confirmação do acordo, PIX que libera o aparelho).
- O botão "Voltar à consulta" volta para /odrescred, não para o portal principal.
- Rodapé: "Atendimento para Odres Cred".

## O que não muda
- Regras de negociação, valores, prazos, confirmação "Li e confirmo", geração de boleto/PIX e registro dos acordos.
- Links antigos como /odres_cred continuam funcionando e levam ao novo portal da Odres.
- Links já enviados nos templates para /novomundo seguem no portal principal (sem Odres). Os templates da Odres Cred devem passar a usar o link /odrescred — vou listar quais templates e campanhas ainda apontam para o portal principal para você trocar.

## Ponto a confirmar depois
- O WhatsApp e o e-mail de contato exibidos continuam os mesmos nos dois portais. Se a UME exigir também um telefone separado para a Odres, me passe o número.

## Detalhes técnicos
- `PortalConsulta` / `ConsultaResultado`: derivar um "escopo do portal" do slug (`odrescred`/`odres_cred` → `['odres_cred']`; demais → `['novo_mundo','ume']`) e passar para `PublicPortalHome`, `PublicPortalResults` e `PortalShell`.
- `PublicPortalResults`: inicializar e carregar wallets só dos credores do escopo (filtrar `PORTAL_CREDORES`); link de voltar e navegação da busca usam o slug do escopo (`/consulta/odrescred/:cpf`).
- `PortalShell`/`PublicPortalHome`: logos, textos e rodapé filtrados pelo escopo.
- Teste pequeno da função de escopo: `odrescred` → só Odres; `novomundo`/`ume` → nunca inclui Odres.
- Sem mudanças no banco nem nas funções do servidor; nenhum custo extra.
