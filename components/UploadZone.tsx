'use client';

import { useCallback, useRef, useState } from 'react';

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export default function UploadZone({ value, onChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => onChange(reader.result as string);
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) readFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`group relative flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-3 border transition-colors ${
        isDragging ? 'border-marigold bg-marigold/5' : 'border-thread/40 hover:border-marigold/60'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) readFile(file);
        }}
      />

      {value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Uploaded garment" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute right-2 top-2 bg-ink/80 px-2 py-1 text-xs text-canvas hover:bg-maroon"
          >
            Remove
          </button>
        </>
      ) : (
        <>
          <span className="font-display text-2xl italic text-thread">Place the garment here</span>
          <span className="text-sm text-thread/70">Drop an image, or click to browse</span>
        </>
      )}
    </div>
  );
}
