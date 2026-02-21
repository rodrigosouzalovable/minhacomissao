import { Percent, Star, Zap, Tag } from 'lucide-react';

export type DescontoFaixa = 'avista' | 'curto' | 'medio' | 'sem';

interface DiscountTier {
  faixa: DescontoFaixa;
  label: string;
  desconto: number;
  parcelas: string;
  icon: React.ReactNode;
  badge?: string;
}

const tiers: DiscountTier[] = [
  { faixa: 'avista', label: 'À vista', desconto: 50, parcelas: '1x', icon: <Star className="h-5 w-5" />, badge: '🔥 Melhor oferta' },
  { faixa: 'curto', label: '2 a 6x', desconto: 40, parcelas: '2-6x', icon: <Zap className="h-5 w-5" /> },
  { faixa: 'medio', label: '7 a 12x', desconto: 30, parcelas: '7-12x', icon: <Percent className="h-5 w-5" /> },
  { faixa: 'sem', label: '13 a 24x', desconto: 0, parcelas: '13-24x', icon: <Tag className="h-5 w-5" /> },
];

interface DiscountTierSelectorProps {
  selected: DescontoFaixa | undefined;
  onSelect: (faixa: DescontoFaixa) => void;
  valorTotal: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function DiscountTierSelector({ selected, onSelect, valorTotal }: DiscountTierSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold" style={{ color: '#ffffffaa' }}>Escolha a melhor condição para você</p>
      <div className="grid grid-cols-2 gap-2">
        {tiers.map((tier) => {
          const isSelected = selected === tier.faixa;
          const valorComDesconto = valorTotal * (1 - tier.desconto / 100);
          const economia = valorTotal - valorComDesconto;

          return (
            <button
              key={tier.faixa}
              onClick={() => onSelect(tier.faixa)}
              className="relative rounded-lg p-3 text-left transition-all duration-200"
              style={{
                background: isSelected ? '#00a86b22' : '#ffffff0a',
                border: isSelected ? '2px solid #00a86b' : '2px solid #ffffff15',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {tier.badge && (
                <span
                  className="absolute -top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: '#ff6b3d', color: '#fff' }}
                >
                  {tier.badge}
                </span>
              )}
              <div className="flex items-center gap-1.5 mb-1" style={{ color: isSelected ? '#00a86b' : '#ffffffaa' }}>
                {tier.icon}
                <span className="font-bold text-sm">{tier.label}</span>
              </div>
              {tier.desconto > 0 ? (
                <>
                  <p className="text-lg font-extrabold" style={{ color: '#00a86b' }}>
                    {tier.desconto}% OFF
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#ffffffaa' }}>
                    Pague {formatCurrency(valorComDesconto)}
                  </p>
                  <p className="text-[10px]" style={{ color: '#00a86b' }}>
                    Economize {formatCurrency(economia)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={{ color: '#ffffffcc' }}>
                    Sem desconto
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#ffffffaa' }}>
                    {formatCurrency(valorTotal)}
                  </p>
                </>
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
