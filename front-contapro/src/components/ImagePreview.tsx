"use client";
import { useState } from "react";

type Props = {
  src: string;
  alt?: string;
  className?: string;
};

export default function ImagePreview({ src, alt, className }: Props) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="p-4 text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-md">
        No se pudo cargar la imagen.
        <div className="mt-2">
          <a href={src} target="_blank" rel="noreferrer" className="underline hover:text-white transition-colors">Abrir en nueva pestaña</a>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={className ?? "h-auto max-h-[70vh] w-auto max-w-full mx-auto object-contain bg-white"}
      style={{ imageRendering: "auto" }}
    />
  );
}