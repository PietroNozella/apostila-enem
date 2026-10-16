"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";

export default function ImagemQuestao({ src, alt }: { src: string; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="mt-4 block w-full cursor-zoom-in text-left" aria-label={`Ampliar imagem: ${alt}`}>
      <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border border-neutral-200" />
      <span className="mt-1 block text-xs text-neutral-500">Toque para ampliar</span>
    </button>
    <dialog ref={dialog} className="m-auto max-h-[95dvh] w-[96vw] max-w-none rounded-xl p-4 backdrop:bg-black/70" aria-label="Imagem ampliada">
      <form method="dialog" className="sticky top-0 mb-3 flex justify-end bg-white"><button className="rounded-lg border px-4 py-2" autoFocus>Fechar imagem</button></form>
      <div className="overflow-auto"><img src={src} alt={alt} loading="lazy" className="mx-auto max-w-none" /></div>
    </dialog>
  </>;
}
