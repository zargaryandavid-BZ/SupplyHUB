"use client";

import { useRef, useState } from "react";

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
};

export function TagInput({ name, defaultValue = "", placeholder = "Add category…" }: Props) {
  const [tags, setTags] = useState<string[]>(() =>
    defaultValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  );
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const value = raw.trim().replace(/,$/, "").trim();
    if (!value || tags.includes(value)) return;
    setTags((prev) => [...prev, value]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const val = (e.target as HTMLInputElement).value;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(val);
    } else if (e.key === "Backspace" && !val && tags.length) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (e.target.value.trim()) addTag(e.target.value);
  }

  return (
    <div>
      <div
        className="tag-input-wrap"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip-remove"
              onClick={(e) => { e.stopPropagation(); remove(tag); }}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="tag-input"
          placeholder={tags.length === 0 ? placeholder : ""}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
      </div>
      <input type="hidden" name={name} value={tags.join(",")} />
    </div>
  );
}
