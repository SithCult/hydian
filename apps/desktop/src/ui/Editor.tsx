import { useEffect, useMemo, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { Block, PartialBlock } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

/**
 * Rich text (BlockNote) for notes and the journal: headings, lists, quotes, checklists, tables, nested
 * blocks. Documents are stored as block JSON; `onChange` gets the blocks and a plain-text shadow, debounced.
 */
export function Editor({
  doc,
  onChange,
  placeholder,
  autoFocus,
  compact,
}: {
  doc: unknown[] | null;
  onChange: (blocks: unknown[], text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  // the document is read once: BlockNote owns it from here on
  const [initial] = useState(() => (doc?.length ? (doc as PartialBlock[]) : undefined));
  const dictionary = useMemo(
    () => ({
      ...en,
      placeholders: {
        ...en.placeholders,
        emptyDocument: placeholder ?? en.placeholders.emptyDocument,
        default: placeholder ?? en.placeholders.default,
      },
    }),
    [placeholder],
  );
  const editor = useCreateBlockNote({ initialContent: initial, dictionary });
  const timer = useRef<number | null>(null);
  const flushRef = useRef(() => {});
  flushRef.current = () => {
    const blocks = editor.document as Block[];
    let text = "";
    try {
      text = blocksToPlain(blocks);
    } catch {
      /* ignore */
    }
    onChange(blocks, text);
  };
  // a pending debounce is flushed on unmount so closing the panel never loses the last keystrokes
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        flushRef.current();
      }
    },
    [],
  );
  return (
    <div className={`editor ${compact ? "compact" : ""}`} data-placeholder={placeholder}>
      <BlockNoteView
        editor={editor}
        theme="dark"
        autoFocus={autoFocus}
        onChange={() => {
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            timer.current = null;
            flushRef.current();
          }, 600);
        }}
      />
    </div>
  );
}

function blocksToPlain(blocks: Block[]): string {
  const out: string[] = [];
  const walk = (b: Block) => {
    const c = b.content as unknown;
    if (Array.isArray(c))
      for (const x of c) {
        const t = (x as { text?: string }).text;
        if (t) out.push(t);
      }
    out.push("\n");
    for (const ch of b.children) walk(ch);
  };
  blocks.forEach(walk);
  return out
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
