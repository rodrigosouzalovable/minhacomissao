import { ReactNode, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTemplateFavoritos } from "@/hooks/useTemplateFavoritos";

export type TemplateFavoriteOption = {
  value: string;
  nome: string;
  idioma?: string | null;
  descricao?: string | null;
  meta?: ReactNode;
};

type Props = {
  tipo: string;
  value: string;
  onValueChange: (value: string) => void;
  options: TemplateFavoriteOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
};

const semAcento = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function TemplateFavoriteSelect({
  tipo,
  value,
  onValueChange,
  options,
  placeholder = "Selecione um template",
  searchPlaceholder = "Digite o nome do template",
  emptyMessage = "Nenhum template encontrado.",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { isFavorito, alternarFavorito } = useTemplateFavoritos(tipo);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const termo = semAcento(search.trim());
    return options
      .filter((option) => !termo || semAcento(option.nome).includes(termo))
      .sort((a, b) => {
        const favA = isFavorito(a) ? 1 : 0;
        const favB = isFavorito(b) ? 1 : 0;
        return favB - favA || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [options, search, isFavorito]);

  return (
    <Popover modal open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-auto min-h-10 w-full justify-between px-3 font-normal", className)}
        >
          <span className={cn("min-w-0 truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? `${selected.nome}${selected.idioma ? ` · ${selected.idioma}` : ""}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList
            className="max-h-80 overscroll-contain"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filtered.map((option) => {
                const favorito = isFavorito(option);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => { onValueChange(option.value); setOpen(false); }}
                    className="items-start gap-2 py-2"
                  >
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium break-words">{option.nome}</span>
                        {option.idioma && <span className="text-xs text-muted-foreground">{option.idioma}</span>}
                        {option.meta}
                      </div>
                      {option.descricao && <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">{option.descricao}</p>}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={favorito ? `Desfavoritar ${option.nome}` : `Favoritar ${option.nome}`}
                      title={favorito ? "Desfavoritar template" : "Favoritar template"}
                      className="h-8 w-8 shrink-0"
                      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                      onClick={(event) => { event.preventDefault(); event.stopPropagation(); alternarFavorito(option); }}
                    >
                      <Star className={cn("h-4 w-4", favorito && "fill-current text-primary")} />
                    </Button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}