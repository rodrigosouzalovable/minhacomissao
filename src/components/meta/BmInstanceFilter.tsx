import { useRef, useState } from "react";
import { Building2, Check, ChevronsUpDown, Grip, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterBmsByName, toggleVisibleBms } from "@/lib/metaBmMenu";

export type BmOption = { id: string; nome: string; summary?: string | number; exhausted?: boolean };

export default function BmInstanceFilter({ bms, selected, onChange, single = false, triggerClassName }: {
  bms: BmOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [size, setSize] = useState({ width: 320, height: 320 });
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; width: number; height: number; maxWidth: number; maxHeight: number } | null>(null);
  const visible = filterBmsByName(bms, search);
  const allVisibleSelected = visible.length > 0 && visible.every((bm) => selected.includes(bm.id));

  const resize = (width: number, height: number, maxWidth: number, maxHeight: number) => {
    setSize({ width: Math.min(maxWidth, Math.max(Math.min(256, maxWidth), width)), height: Math.min(maxHeight, Math.max(Math.min(220, maxHeight), height)) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={bms.length === 0} className={triggerClassName} role={single ? "combobox" : undefined} aria-expanded={open} aria-label={single ? "Selecionar BM" : undefined}>
          {!single && <Building2 className="h-3.5 w-3.5 mr-1.5" />}
          {single ? <><span className="min-w-0 flex-1 truncate text-left">{bms.find((bm) => selected.includes(bm.id))?.nome ?? "Selecionar BM"}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" /></> : selected.length > 0 ? `BMs (${selected.length})` : "BMs"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="start"
        collisionPadding={8}
        aria-label="Filtro de BMs"
        className="flex flex-col overflow-hidden p-0 max-w-[calc(100vw-16px)] max-h-[var(--radix-popover-content-available-height)]"
        style={{ width: size.width, height: size.height }}
      >
        <div className="shrink-0 border-b p-3 space-y-2">
          <div className="text-sm font-semibold">Business Managers</div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input aria-label="Buscar BM pelo nome" placeholder="Buscar BM pelo nome" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 pl-8 pr-9" />
            {search && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-9" aria-label="Limpar busca de BM" title="Limpar busca" onClick={() => setSearch("")}><X className="h-4 w-4" /></Button>}
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
          onWheelCapture={(event) => event.stopPropagation()}
        >
          {visible.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nenhuma BM encontrada.</p> : visible.map((bm) => single ? (
            <Button key={bm.id} type="button" variant="ghost" role="option" aria-selected={selected.includes(bm.id)} className="h-auto w-full justify-start gap-2 rounded-sm px-2 py-2 text-sm" onClick={() => { onChange([bm.id]); setOpen(false); }}>
              <Check className={`h-4 w-4 shrink-0 ${selected.includes(bm.id) ? "opacity-100" : "opacity-0"}`} />
              <span className="min-w-0 flex-1 whitespace-normal break-words text-left">{bm.nome}</span>
            </Button>
          ) : (
            <label key={bm.id} className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground">
              <Checkbox checked={selected.includes(bm.id)} aria-label={`Filtrar ${bm.nome}`} onCheckedChange={() => onChange(selected.includes(bm.id) ? selected.filter((id) => id !== bm.id) : [...selected, bm.id])} />
              <span className="min-w-0 flex-1 break-words">{bm.nome}</span>
              <span className={`shrink-0 text-xs ${bm.exhausted ? "text-destructive font-medium" : "text-muted-foreground"}`}>{bm.summary}</span>
            </label>
          ))}
        </div>
        <div className="shrink-0 border-t p-2 pr-8 flex flex-wrap gap-1 relative">
          {!single && <><Button type="button" variant="ghost" size="sm" disabled={visible.length === 0} onClick={() => onChange(toggleVisibleBms(selected, visible.map((bm) => bm.id)))}>{allVisibleSelected ? "Desmarcar todas" : "Selecionar todas"}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>Limpar filtro</Button></>}
          <Button
            type="button" variant="ghost" size="icon"
            className="absolute bottom-0 right-0 h-7 w-7 cursor-se-resize touch-none"
            aria-label="Redimensionar menu BMs" title="Redimensionar menu BMs"
            onPointerDown={(event) => {
              const rect = contentRef.current?.getBoundingClientRect();
              if (!rect) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, maxWidth: window.innerWidth - rect.left - 8, maxHeight: window.innerHeight - rect.top - 8 };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (drag) resize(drag.width + event.clientX - drag.x, drag.height + event.clientY - drag.y, drag.maxWidth, drag.maxHeight);
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            onLostPointerCapture={() => { dragRef.current = null; }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
              const rect = contentRef.current?.getBoundingClientRect();
              if (!rect) return;
              event.preventDefault();
              resize(rect.width + (event.key === "ArrowRight" ? 20 : event.key === "ArrowLeft" ? -20 : 0), rect.height + (event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0), window.innerWidth - rect.left - 8, window.innerHeight - rect.top - 8);
            }}
          ><Grip className="h-4 w-4 text-muted-foreground" /></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}