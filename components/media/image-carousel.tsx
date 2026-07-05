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
  const active = images[activeIndex];

  if (!active) {
    return null;
  }

  function move(delta: number) {
    setActiveIndex((current) => (current + delta + images.length) % images.length);
  }

  return (
    <div className="relative h-full">
      <Image alt={active.title} className="object-contain" fill priority src={active.mediaUrl} />
      {images.length > 1 ? (
        <>
          <Button
            aria-label="前の画像"
            className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/60 p-0 text-white hover:bg-black/75"
            onClick={() => move(-1)}
            type="button"
            variant="ghost"
          >
            <ChevronLeft size={22} />
          </Button>
          <Button
            aria-label="次の画像"
            className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/60 p-0 text-white hover:bg-black/75"
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
                  "size-2 rounded-full transition",
                  index === activeIndex ? "bg-white" : "bg-white/45 hover:bg-white/70",
                ].join(" ")}
                key={image.id}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
