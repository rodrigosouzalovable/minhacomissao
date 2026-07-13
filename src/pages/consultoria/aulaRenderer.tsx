import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractHeadings(md: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  for (const line of md.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    let id = slugify(m[1]);
    let i = 2;
    while (seen.has(id)) id = `${slugify(m[1])}-${i++}`;
    seen.add(id);
    out.push({ id, text: m[1] });
  }
  return out;
}

/** Turn `> 💡 ...`, `> ⚠️ ...`, `> ✅ ...`, `> ℹ️ ...` blockquotes into callout markers. */
function preprocess(md: string) {
  return md.replace(
    /(^|\n)>\s*(💡|⚠️|✅|ℹ️)\s*([^\n]+(?:\n>[^\n]*)*)/g,
    (_full, pre, emoji, body) => {
      const clean = String(body)
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join(" ")
        .trim();
      const kind =
        emoji === "💡" ? "tip" : emoji === "⚠️" ? "warn" : emoji === "✅" ? "ok" : "info";
      return `${pre}\n:::callout{kind=${kind}}\n${clean}\n:::\n`;
    },
  );
}

function Callout({ kind, children }: { kind: string; children: React.ReactNode }) {
  const map: Record<string, { icon: any; label: string; bg: string; border: string; iconColor: string }> = {
    tip: {
      icon: Lightbulb,
      label: "Dica do consultor",
      bg: "bg-amber-500/5",
      border: "border-amber-500/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    warn: {
      icon: AlertTriangle,
      label: "Atenção",
      bg: "bg-destructive/5",
      border: "border-destructive/30",
      iconColor: "text-destructive",
    },
    ok: {
      icon: CheckCircle2,
      label: "Boa prática",
      bg: "bg-emerald-500/5",
      border: "border-emerald-500/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    info: {
      icon: Info,
      label: "Nota",
      bg: "bg-primary/5",
      border: "border-primary/30",
      iconColor: "text-primary",
    },
  };
  const c = map[kind] ?? map.info;
  const Icon = c.icon;
  return (
    <div className={`my-6 rounded-xl border ${c.border} ${c.bg} p-4 md:p-5`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${c.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${c.iconColor}`}>
            {c.label}
          </div>
          <div className="text-sm md:text-[0.95rem] leading-relaxed text-foreground/90">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const text = String(children ?? "").replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className ?? "")?.[1] ?? "code";
  return (
    <div className="my-5 rounded-lg border border-border overflow-hidden bg-muted/40">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/60">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {lang}
        </span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[0.85rem] leading-relaxed font-mono">
        <code>{text}</code>
      </pre>
    </div>
  );
}

const components: Components = {
  h1: () => null,
  h2: ({ children }) => {
    const text = String(Array.isArray(children) ? children.join("") : children ?? "");
    const id = slugify(text);
    return (
      <h2
        id={id}
        className="scroll-mt-24 mt-10 mb-4 flex items-center gap-3 text-xl md:text-2xl font-bold tracking-tight text-foreground"
      >
        <span className="inline-block w-1 h-6 md:h-7 rounded-full bg-primary" />
        <span>{text}</span>
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-base md:text-lg font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[0.95rem] md:text-base leading-relaxed text-foreground/85">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-4 space-y-2 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 space-y-2 list-none counter-reset-[step] pl-1 [counter-reset:step]">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    const ordered = (props as any).ordered;
    if (ordered) {
      return (
        <li className="flex gap-3 items-start [counter-increment:step]">
          <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center before:content-[counter(step)]" />
          <span className="flex-1 text-[0.95rem] leading-relaxed text-foreground/85">
            {children}
          </span>
        </li>
      );
    }
    return (
      <li className="flex gap-3 items-start">
        <span className="mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary/60" />
        <span className="flex-1 text-[0.95rem] leading-relaxed text-foreground/85">
          {children}
        </span>
      </li>
    );
  },
  code: ({ className, children, ...props }: any) => {
    const inline = !className;
    if (inline) {
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground border border-border/50">
          {children}
        </code>
      );
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  pre: ({ children }) => <>{children}</>,
  hr: () => <hr className="my-8 border-t border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-5 border-l-4 border-primary/40 pl-4 italic text-foreground/80">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left px-4 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wide">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-foreground/85 align-top">{children}</td>
  ),
};

export function AulaMarkdown({ content }: { content: string }) {
  const processed = preprocess(content);
  // Split around ::: callout blocks
  const parts = processed.split(/:::callout\{kind=(tip|warn|ok|info)\}\n([\s\S]*?)\n:::/g);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      const md = parts[i];
      if (md && md.trim()) {
        nodes.push(
          <ReactMarkdown key={`md-${i}`} remarkPlugins={[remarkGfm]} components={components}>
            {md}
          </ReactMarkdown>,
        );
      }
    } else if (i % 3 === 1) {
      const kind = parts[i];
      const body = parts[i + 1] ?? "";
      nodes.push(
        <Callout key={`cb-${i}`} kind={kind}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...components, p: ({ children }) => <>{children}</> }}>
            {body}
          </ReactMarkdown>
        </Callout>,
      );
      i++; // skip body index (handled)
    }
  }
  return <div className="aula-content">{nodes}</div>;
}
