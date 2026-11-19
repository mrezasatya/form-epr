"use client";

import { useId, useState, type KeyboardEvent } from "react";

/**
 * Input "tag": ketik lalu Enter/koma untuk menambah; bisa tempel "a, b, c".
 * Saran (suggestions) ditampilkan via <datalist> — tetap boleh ketik bebas.
 */
export function TagInput({
  id,
  value,
  onChange,
  onBlur,
  suggestions = [],
  placeholder,
  invalid,
  max = 30,
  splitOnComma = true,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  onBlur?: () => void;
  suggestions?: string[];
  placeholder?: string;
  invalid?: boolean;
  max?: number;
  splitOnComma?: boolean;
}) {
  const [text, setText] = useState("");
  const listId = useId();

  function add(raw: string) {
    const parts = (splitOnComma ? raw.split(",") : [raw]).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      // Samakan kapitalisasi dengan saran bila cocok
      const match = suggestions.find((s) => s.toLowerCase() === p.toLowerCase()) ?? p;
      if (!next.some((v) => v.toLowerCase() === match.toLowerCase()) && next.length < max) next.push(match);
    }
    onChange(next);
    setText("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || (splitOnComma && e.key === ",")) {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        className={`input flex min-h-11 flex-wrap items-center gap-1.5 py-1.5 ${invalid ? "input-error" : ""}`}
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
      >
        {value.map((v) => (
          <span key={v} className="chip">
            {v}
            <button
              type="button"
              aria-label={`Hapus ${v}`}
              className="ml-0.5 rounded-full px-1 text-brand-700 hover:bg-brand-100"
              onClick={() => onChange(value.filter((x) => x !== v))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          list={suggestions.length ? listId : undefined}
          className="min-w-[8rem] flex-1 border-0 bg-transparent p-1 text-base outline-none sm:text-sm"
          value={text}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => {
            const v = e.target.value;
            // Pilihan dari datalist langsung ditambahkan
            if (suggestions.includes(v)) add(v);
            else setText(v);
          }}
          onKeyDown={onKey}
          onBlur={() => {
            if (text.trim()) add(text);
            onBlur?.();
          }}
        />
      </div>
      {!!suggestions.length && (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      )}
    </div>
  );
}
