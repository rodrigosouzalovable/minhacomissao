import { Percent, Star, Zap, Tag, Lock, TrendingDown } from 'lucide-react';

export type DescontoFaixa = 'avista' | 'curto' | 'medio' | 'sem';

interface DiscountTier {
  faixa: DescontoFaixa;
  label: string;
  desconto: number;
  parcelas: string;
  icon: React.ReactNode;
  textoPersuasivo: string;
}

const tiers: DiscountTier[] = [
  { faixa: 'avista', label: 'À Vista', desconto: 50, parcelas: '1x', icon: <Star className="h-6 w-6" />, textoPersuasivo: 'Quite sua dívida hoje!' },
  { faixa: 'curto', label: '2 a 6x', desconto: 40, parcelas: '2-6x', icon: <Zap className="h-5 w-5" />, textoPersuasivo: 'Parcele com ótimo desconto' },
  { faixa: 'medio', label: '7 a 12x', desconto: 30, parcelas: '7-12x', icon: <Percent className="h-5 w-5" />, textoPersuasivo: 'Parcelas que cabem no bolso' },
  { faixa: 'sem', label: '13 a 24x', desconto: 0, parcelas: '13-24x', icon: <Tag className="h-5 w-5" />, textoPersuasivo: 'Máximo de parcelas' },
];

interface DiscountTierSelectorProps {
  selected: DescontoFaixa | undefined;
  onSelect: (faixa: DescontoFaixa) => void;
  valorTotal: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const VALOR_MINIMO_PARCELA = 90;

export default function DiscountTierSelector({ selected, onSelect, valorTotal }: DiscountTierSelectorProps) {
  const avista = tiers[0];
  const parcelados = tiers.slice(1);

  const avistaValor = valorTotal * (1 - avista.desconto / 100);
  const avistaEconomia = valorTotal - avistaValor;
  const avistaSelected = selected === 'avista';
  const avistaMinParcelas = getMinParcelas('avista');
  const avistaDisabled = (avistaValor / avistaMinParcelas) < VALOR_MINIMO_PARCELA;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#ffffffaa' }}>
        💰 Escolha a melhor condição para você
      </p>

      {/* Card À Vista - Full width, destaque máximo */}
      <button
        onClick={() => !avistaDisabled && onSelect('avista')}
        disabled={avistaDisabled}
        className="relative w-full rounded-2xl p-5 text-left transition-all duration-300 overflow-hidden group"
        style={{
          background: avistaSelected
            ? 'linear-gradient(135deg, #00a86b, #00cc88)'
            : 'linear-gradient(135deg, #00a86b33, #00cc8833)',
          border: avistaSelected ? '2px solid #00ff88' : '2px solid #00a86b55',
          boxShadow: avistaSelected ? '0 0 30px rgba(0, 168, 107, 0.4), 0 0 60px rgba(0, 168, 107, 0.1)' : '0 4px 20px rgba(0,0,0,0.2)',
          opacity: avistaDisabled ? 0.4 : 1,
          cursor: avistaDisabled ? 'not-allowed' : 'pointer',
          animation: !avistaDisabled ? 'pulse-border 2s ease-in-out infinite' : 'none',
        }}
      >
        {/* Badge Melhor Oferta */}
        <span
          className="absolute -top-0 right-4 text-xs font-black px-4 py-1.5 rounded-b-xl uppercase tracking-wide"
          style={{
            background: 'linear-gradient(135deg, #ff6b3d, #ff9a5c)',
            color: '#fff',
            animation: 'shimmer 2s ease-in-out infinite',
            boxShadow: '0 4px 15px rgba(255, 107, 61, 0.4)',
          }}
        >
          🔥 MELHOR OFERTA
        </span>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: avistaSelected ? '#fff' : '#ffd700', animation: 'float 3s ease-in-out infinite' }}>
                <Star className="h-7 w-7 fill-current" />
              </span>
              <span className="font-black text-xl" style={{ color: avistaSelected ? '#fff' : '#00ff88' }}>
                {avista.label}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm line-through" style={{ color: '#ff6b6b' }}>
                {formatCurrency(valorTotal)}
              </span>
              <span className="text-3xl font-black" style={{ color: avistaSelected ? '#fff' : '#00ff88' }}>
                {formatCurrency(avistaValor)}
              </span>
            </div>

            <p className="text-sm font-bold" style={{ color: avistaSelected ? '#ffffffdd' : '#ffffffaa' }}>
              {avista.textoPersuasivo}
            </p>
          </div>

          <div className="text-right">
            <div
              className="inline-block rounded-xl px-4 py-2"
              style={{
                background: avistaSelected ? '#ffffff22' : '#00a86b22',
                border: '1px solid #00ff8844',
              }}
            >
              <p className="text-2xl font-black" style={{ color: '#00ff88' }}>
                {avista.desconto}%
              </p>
              <p className="text-[10px] font-bold uppercase" style={{ color: '#00ff88cc' }}>OFF</p>
            </div>
          </div>
        </div>

        {/* Economia em destaque */}
        <div
          className="mt-3 rounded-lg px-3 py-2 flex items-center gap-2"
          style={{
            background: avistaSelected ? '#ffffff15' : '#00a86b15',
            border: '1px solid #00ff8833',
          }}
        >
          <TrendingDown className="h-4 w-4" style={{ color: '#00ff88' }} />
          <p className="text-sm font-bold" style={{ color: '#00ff88' }}>
            Você economiza {formatCurrency(avistaEconomia)}
          </p>
        </div>

        {avistaDisabled && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: '#000000aa' }}>
            <div className="text-center">
              <Lock className="h-8 w-8 mx-auto mb-1" style={{ color: '#ffffff55' }} />
              <p className="text-xs" style={{ color: '#ffffff77' }}>Indisponível para este valor</p>
            </div>
          </div>
        )}
      </button>

      {/* Separador */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #ffffff22, transparent)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#ffffff55' }}>
          ou parcele com desconto
        </span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, #ffffff22, transparent)' }} />
      </div>

      {/* Cards parcelados - grid 3 colunas */}
      <div className="grid grid-cols-3 gap-2">
        {parcelados.map((tier) => {
          const isSelected = selected === tier.faixa;
          const valorComDesconto = valorTotal * (1 - tier.desconto / 100);
          const economia = valorTotal - valorComDesconto;
          const minParcelas = getMinParcelas(tier.faixa);
          const valorParcelaMin = valorComDesconto / minParcelas;
          const disabled = valorParcelaMin < VALOR_MINIMO_PARCELA;
          const perda = avista.desconto - tier.desconto;

          return (
            <button
              key={tier.faixa}
              onClick={() => !disabled && onSelect(tier.faixa)}
              disabled={disabled}
              className="relative rounded-xl p-3 text-left transition-all duration-200"
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, #00a86b22, #00cc8822)'
                  : '#ffffff08',
                border: isSelected ? '2px solid #00a86b' : '2px solid #ffffff12',
                transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 20px rgba(0,168,107,0.2)' : 'none',
                opacity: disabled ? 0.35 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="flex items-center gap-1.5 mb-2" style={{ color: isSelected ? '#00a86b' : '#ffffffaa' }}>
                {tier.icon}
                <span className="font-bold text-xs">{tier.label}</span>
              </div>

              {tier.desconto > 0 ? (
                <>
                  <p className="text-xl font-black" style={{ color: '#00a86b' }}>
                    {tier.desconto}%
                  </p>
                  <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#00a86bcc' }}>OFF</p>
                  <p className="text-[10px]" style={{ color: '#ffffffaa' }}>
                    {formatCurrency(valorComDesconto)}
                  </p>
                  {perda > 0 && (
                    <p className="text-[9px] mt-1" style={{ color: '#ff6b6b99' }}>
                      -{perda}% desconto vs à vista
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#ffffffbb' }}>
                    Sem desconto
                  </p>
                  <p className="text-[10px]" style={{ color: '#ffffffaa' }}>
                    {formatCurrency(valorTotal)}
                  </p>
                  <p className="text-[9px] mt-1" style={{ color: '#ff6b6b99' }}>
                    -{avista.desconto}% desconto vs à vista
                  </p>
                </>
              )}

              <p className="text-[9px] mt-1.5 font-medium" style={{ color: '#ffffff66' }}>
                {tier.textoPersuasivo}
              </p>

              {disabled && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: '#000000aa' }}>
                  <Lock className="h-5 w-5" style={{ color: '#ffffff44' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getDesconto(faixa: DescontoFaixa): number {
  switch (faixa) {
    case 'avista': return 50;
    case 'curto': return 40;
    case 'medio': return 30;
    case 'sem': return 0;
  }
}

export function getMinParcelas(faixa: DescontoFaixa): number {
  switch (faixa) {
    case 'avista': return 1;
    case 'curto': return 2;
    case 'medio': return 7;
    case 'sem': return 13;
  }
}

export function getMaxParcelasFaixa(faixa: DescontoFaixa): number {
  switch (faixa) {
    case 'avista': return 1;
    case 'curto': return 6;
    case 'medio': return 12;
    case 'sem': return 24;
  }
}
