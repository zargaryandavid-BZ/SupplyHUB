"use client";

import { useRef, useState } from "react";

type Preview = { name: string; url: string; isImage: boolean; file: File };

export function ImageUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const toAdd: Preview[] = Array.from(incoming).map((f) => ({
      file: f,
      name: f.name,
      url: URL.createObjectURL(f),
      isImage: f.type.startsWith("image/"),
    }));
    setPreviews((prev) => {
      const next = [...prev, ...toAdd];
      // Keep the hidden file input in sync with the full list
      if (inputRef.current) {
        const dt = new DataTransfer();
        next.forEach((p) => dt.items.add(p.file));
        inputRef.current.files = dt.files;
      }
      return next;
    });
  }

  function remove(index: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      const next = prev.filter((_, i) => i !== index);
      if (inputRef.current) {
        const dt = new DataTransfer();
        next.forEach((p) => dt.items.add(p.file));
        inputRef.current.files = dt.files;
      }
      return next;
    });
  }

  const hasFiles = previews.length > 0;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        name="attachments"
        multiple
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={(e) => addFiles(e.target.files)}
      />

      {/* ── Empty state: full drop zone ── */}
      {!hasFiles && (
        <div
          className={`upload-zone${dragging ? " drag-over" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", marginBottom: 8 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <div className="upload-text">
            <strong>Click to upload</strong> or drag &amp; drop
          </div>
          <div className="upload-hint">PNG, JPG, PDF · up to 10 MB each</div>
        </div>
      )}

      {/* ── Has files: thumbnails + compact + tile ── */}
      {hasFiles && (
        <div
          className="upload-previews"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          {previews.map((p, i) => (
            <div key={i} className="upload-thumb">
              {p.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.name} />
              ) : (
                <div className="upload-thumb-pdf">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{p.name}</span>
                </div>
              )}
              <button
                type="button"
                className="upload-remove"
                onClick={() => remove(i)}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}

          {/* + Add more tile */}
          <div
            className={`upload-add-tile${dragging ? " drag-over" : ""}`}
            onClick={() => {
              // Reset the input so the same file can be re-selected if needed
              if (inputRef.current) inputRef.current.value = "";
              inputRef.current?.click();
            }}
            title="Add more files"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add more</span>
          </div>
        </div>
      )}
    </div>
  );
}
