import Link from "next/link";
import type { ReactNode } from "react";

type MarkdownBioProps = {
  text: string;
};

const linkPattern = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s]+)/g;

export function MarkdownBio({ text }: MarkdownBioProps) {
  const lines = text.split(/\r?\n/);

  return (
    <div className="mt-4 space-y-1 text-sm leading-7 text-muted-foreground">
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <div aria-hidden="true" className="h-3" key={index} />;
        }

        if (line.trimStart().startsWith("- ")) {
          return (
            <p className="pl-4" key={index}>
              <span className="mr-2">-</span>
              {renderInlineMarkdown(line.trimStart().slice(2))}
            </p>
          );
        }

        return <p key={index}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(linkPattern)) {
    if (match.index === undefined) {
      continue;
    }

    if (match.index > lastIndex) {
      parts.push(renderEmphasis(text.slice(lastIndex, match.index), `text-${lastIndex}`));
    }

    const label = match[1] || match[3] || "";
    const href = match[2] || match[3] || "";
    parts.push(
      <Link className="text-primary underline-offset-4 hover:underline" href={href} key={`link-${match.index}`} rel="noreferrer" target="_blank">
        {label}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(renderEmphasis(text.slice(lastIndex), `text-${lastIndex}`));
  }

  return parts;
}

function renderEmphasis(text: string, keyPrefix: string) {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong className="font-bold text-foreground" key={`${keyPrefix}-bold-${index}`}>
          {segment.slice(2, -2)}
        </strong>
      );
    }

    if (segment.startsWith("*") && segment.endsWith("*")) {
      return (
        <em className="italic" key={`${keyPrefix}-italic-${index}`}>
          {segment.slice(1, -1)}
        </em>
      );
    }

    return <span key={`${keyPrefix}-plain-${index}`}>{segment}</span>;
  });
}
