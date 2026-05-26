"use client";

import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type WithChildren = { children?: ReactNode };

const components: Components = {
  h1: ({ children }: WithChildren) => (
    <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }: WithChildren) => (
    <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>
  ),
  h3: ({ children }: WithChildren) => (
    <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>
  ),
  h4: ({ children }: WithChildren) => (
    <h4 className="text-sm font-semibold mt-3 mb-1">{children}</h4>
  ),
  p: ({ children }: WithChildren) => (
    <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: WithChildren) => (
    <ul className="list-disc pl-6 mb-2 text-sm space-y-1">{children}</ul>
  ),
  ol: ({ children }: WithChildren) => (
    <ol className="list-decimal pl-6 mb-2 text-sm space-y-1">{children}</ol>
  ),
  li: ({ children }: WithChildren) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-purple-600 underline hover:no-underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }: WithChildren) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: WithChildren) => <em className="italic">{children}</em>,
  blockquote: ({ children }: WithChildren) => (
    <blockquote className="border-l-4 border-muted pl-4 italic text-muted-foreground my-2">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: WithChildren & { className?: string }) => {
    const inline = !className;
    if (inline) {
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
      );
    }
    return <code className="font-mono text-xs">{children}</code>;
  },
  pre: ({ children }: WithChildren) => (
    <pre className="bg-muted rounded p-3 overflow-x-auto text-xs my-2">{children}</pre>
  ),
  hr: () => <hr className="my-4 border-muted" />,
  table: ({ children }: WithChildren) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: WithChildren) => (
    <th className="border px-2 py-1 bg-muted text-left font-semibold">{children}</th>
  ),
  td: ({ children }: WithChildren) => <td className="border px-2 py-1">{children}</td>,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("wrap-break-word", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
