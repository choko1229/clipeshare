"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type CarouselImage = {
  id: string;
  mediaUrl: string;
  thumbnailUrl?: string | null;
  title: string;
};

export function ImageCarousel({ images }: { images: CarouselImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const canMovePrevious = activeIndex > 0;
  const canMoveNext = activeIndex < images.length - 1;

  function move(delta: number) {
    setActiveIndex((current) => Math.min(images.length - 1, Math.max(0, current + delta)));
  }

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(-${activeIndex * 100}%)`,
        }}
      >
        {images.map((image) => (
          <div className="relative h-full w-full shrink-0" key={image.id}>
            <Image alt={image.title} className="object-contain" fill priority src={image.mediaUrl} />
          </div>
        ))}
      </div>

      {images.length > 1 ? (
        <>
          <Button
            aria-label="前の画像"
            className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/60 p-0 text-white hover:bg-black/75 disabled:opacity-30"
            disabled={!canMovePrevious}
            onClick={() => move(-1)}
            type="button"
            variant="ghost"
          >
            <ChevronLeft size={22} />
          </Button>
          <Button
            aria-label="次の画像"
            className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/60 p-0 text-white hover:bg-black/75 disabled:opacity-30"
            disabled={!canMoveNext}
            onClick={() => move(1)}
            type="button"
            variant="ghost"
          >
            <ChevronRight size={22} />
          </Button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((image, index) => (
              <button
                aria-label={`${index + 1}枚目を表示`}
                className={[
                  "h-2 rounded-full transition-all",
                  index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/45 hover:bg-white/70",
                ].join(" ")}
                key={image.id}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
          <div className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-xs font-bold text-white">
            {activeIndex + 1} / {images.length}
          </div>
        </>
      ) : null}
    </div>
  );
}
