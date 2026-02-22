

# Reduzir Logomarca Novo Mundo na Pagina de Debitos

## Problema
A logomarca da Novo Mundo na pagina de resultado de consulta (`ConsultaResultado.tsx`) esta com altura fixa de `h-14` (56px), o que faz com que logos mais largas como a da Novo Mundo fiquem desproporcionais no cabecalho.

## Solucao
Reduzir a altura da logomarca e adicionar restricao de largura maxima para que se encaixe proporcionalmente no cabecalho, seguindo o mesmo padrao ja utilizado no `PortalConsulta.tsx`.

## Detalhes Tecnicos

**Arquivo:** `src/pages/ConsultaResultado.tsx`, linha 210

Alterar:
```html
<img src={config.logos.negociacao} alt={config.nome} className="h-14" />
```

Para:
```html
<img src={config.logos.negociacao} alt={config.nome} className="h-10 max-w-[160px] object-contain" />
```

- `h-10` (40px) reduz a altura para um tamanho mais adequado ao cabecalho
- `max-w-[160px]` limita a largura para logos horizontais como a Novo Mundo
- `object-contain` garante que a proporcao da imagem seja mantida

