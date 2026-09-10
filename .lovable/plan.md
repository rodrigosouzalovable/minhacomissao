# Envio repetido para os mesmos números: o que aconteceu e como evitar

## O que a checagem mostrou (dados reais)

Sim, houve repetição — e ela veio da lista, não do envio.

- A campanha de hoje, "UME + NOVO MUNDO 11", tem 2.949 contatos. **2.949 deles estão na planilha de ontem** (`UME_NOVO_MUNDO_10.xlsx`). Da planilha nova (`UME_NOVO_MUNDO_11.xlsx`, 3.655 números) entraram **apenas 2**.
- A ordem dos contatos da campanha de hoje é exatamente a ordem da planilha de ontem.
- 2.373 números receberam mensagem ontem e hoje.
- A cliente do print (65993425705) está só na planilha de ontem: recebeu `dados_cadastrais` em 09/09 13:26 e `novo_seguranca_do_processo` em 10/09 12:44.
- As duas planilhas realmente quase não se cruzam (2 números em comum), então o problema não é a planilha nova.

Conclusão: a campanha de hoje foi disparada com a lista antiga ainda no campo de destinatários — a planilha nova não substituiu a anterior antes do disparo. E hoje o sistema **não tem nenhuma trava** que perceba que aqueles números já receberam mensagem recentemente: ele só remove blacklist e supressão.

## O que vou fazer

1. **Trava de repetição entre campanhas.** Ao iniciar uma campanha, o sistema confere quais números já receberam mensagem nos últimos X dias (padrão 7, ajustável) e **remove esses números do disparo**, registrando a lista separada — igual ao que já existe para a blacklist.
2. **Aviso antes de confirmar.** A tela de confirmação passa a mostrar: "N contatos já receberam mensagem nos últimos 7 dias e serão ignorados". Se a lista inteira cair nessa condição, o disparo é recusado com explicação.
3. **Aviso de lista repetida na importação.** Ao importar uma planilha, se a lista resultante for praticamente a mesma da última campanha (mais de 80% dos números iguais), aparece um alerta em destaque: "esta lista é quase idêntica à campanha X de dd/mm — confirme se importou o arquivo certo".
4. **Visibilidade.** Em Campanhas → Ver detalhes, um bloco "Ignorados por envio recente (N)" com copiar e baixar Excel, no mesmo formato do bloco da blacklist.
5. **Campanha em andamento.** A "UME + NOVO MUNDO 11" ainda está rodando com a lista errada. Posso pausá-la e recriá-la com a planilha correta — só faço isso se você autorizar.

## Detalhes técnicos

- Migração: colunas `dias_antirrepeticao int default 7` e `ignorados_repetidos jsonb` em `envio_meta_job`; chave `antirrepeticao_dias` em `meta_envio_pool_config` para o padrão global.
- `supabase/functions/envio-meta-massa-iniciar/index.ts`: após a higiene de blacklist/supressão, consulta em lotes de 500 sufixos (`phone_suffix8`) os itens de `envio_meta_job_item` com `status='enviado'` e `processado_em > now() - interval 'N days'`, remove os coincidentes, grava em `ignorados_repetidos` e devolve o total na resposta.
- `src/pages/EnvioMeta.tsx`: consulta prévia (mesma janela) para o texto de confirmação; comparação de sobreposição com a última campanha do usuário no `onConfirm` do `MapearColunasImportDialog`.
- `src/components/meta/CampanhaDetalheDialog.tsx`: bloco novo lendo `ignorados_repetidos`.
- Sem mudança no ritmo de envio, nas instâncias ou nas regras de qualidade.
