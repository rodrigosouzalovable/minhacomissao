import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, Maximize2, ExternalLink } from 'lucide-react';

const MIN = 0.5;
const MAX = 8;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  const zoomAt = useCallback((next: number, px?: number, py?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = px ?? rect.width / 2;
    const cy = py ?? rect.height / 2;
    const { zoom: z, offset: o } = stateRef.current;
    const n = clamp(next);
    const k = n / z;
    setZoom(n);
    setOffset({ x: cx - (cx - o.x) * k, y: cy - (cy - o.y) * k });
  }, []);

  const reset = useCallback(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, []);

  useEffect(() => { reset(); }, [src, reset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const dx = e.deltaX * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const { zoom: z } = stateRef.current;
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        zoomAt(z * Math.exp(-dy * (e.ctrlKey && Math.abs(dy) < 20 ? 0.01 : 0.0015)), e.clientX - rect.left, e.clientY - rect.top);
      } else if (z > 1) {
        setOffset((o) => ({ x: o.x - dx, y: o.y - dy }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(stateRef.current.zoom * 1.25); }
      else if (e.key === '-') { e.preventDefault(); zoomAt(stateRef.current.zoom / 1.25); }
      else if (e.key === '0') { e.preventDefault(); reset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoomAt, reset]);

  const btn = 'text-white/80 hover:text-white transition p-2 rounded-full bg-white/10 hover:bg-white/20';

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 animate-in fade-in-0 duration-200">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button className={btn} title="Diminuir (-)" onClick={() => zoomAt(zoom / 1.25)}><ZoomOut className="h-5 w-5" /></button>
        <span className="min-w-[56px] text-center text-sm text-white/90 tabular-nums">{Math.round(zoom * 100)}%</span>
        <button className={btn} title="Aumentar (+)" onClick={() => zoomAt(zoom * 1.25)}><ZoomIn className="h-5 w-5" /></button>
        <button className={btn} title="Ajustar à tela (0)" onClick={reset}><Maximize2 className="h-5 w-5" /></button>
        <a className={btn} title="Abrir original" href={src} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-5 w-5" /></a>
        <button className={btn} title="Fechar (Esc)" onClick={onClose}><X className="h-6 w-6" /></button>
      </div>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: 'none', cursor: zoom > 1 ? (drag.current ? 'grabbing' : 'grab') : 'default' }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, moved: false };
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          if (d.moved) setOffset({ x: d.ox + dx, y: d.oy + dy });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d?.moved && e.target === e.currentTarget) onClose();
        }}
        onDoubleClick={(e) => {
          const rect = containerRef.current!.getBoundingClientRect();
          if (zoom > 1.01) reset(); else zoomAt(2, e.clientX - rect.left, e.clientY - rect.top);
        }}
      >
        <div
          className="h-full w-full p-4 sm:p-6 md:p-10 flex items-center justify-center pointer-events-none"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          <img src={src} alt="Imagem ampliada" draggable={false} className="h-full w-full object-contain select-none" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
