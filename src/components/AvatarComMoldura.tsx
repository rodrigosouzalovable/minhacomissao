import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { MetaTier } from '@/hooks/useTierMeta';

const tierStyles: Record<MetaTier, string> = {
  none: '',
  bronze: 'ring-2 ring-offset-2 ring-offset-background ring-amber-700',
  prata: 'ring-2 ring-offset-2 ring-offset-background ring-slate-300',
  ouro: 'ring-[3px] ring-offset-2 ring-offset-background ring-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.7)] animate-pulse',
  diamante:
    'ring-[3px] ring-offset-2 ring-offset-background ring-fuchsia-400 shadow-[0_0_16px_rgba(232,121,249,0.8)] animate-pulse',
};

const tierLabel: Record<MetaTier, string> = {
  none: '',
  bronze: '🥉',
  prata: '🥈',
  ouro: '🥇',
  diamante: '💎',
};

interface Props {
  src?: string | null;
  fallback: string;
  tier: MetaTier;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  className?: string;
}

const sizeCls = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export function AvatarComMoldura({ src, fallback, tier, size = 'md', showBadge = true, className }: Props) {
  return (
    <div className={cn('relative inline-block', className)}>
      <Avatar className={cn(sizeCls[size], tierStyles[tier])}>
        {src && <AvatarImage src={src} />}
        <AvatarFallback>{fallback.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      {showBadge && tier !== 'none' && (
        <span className="absolute -bottom-1 -right-1 text-base bg-background rounded-full px-1 leading-none">
          {tierLabel[tier]}
        </span>
      )}
    </div>
  );
}
