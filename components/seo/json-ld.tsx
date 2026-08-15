type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

export function JsonLd({ data }: JsonLdProps) {
  // "</script>" によるHTML解釈の中断を防ぐためエスケープする。
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return <script dangerouslySetInnerHTML={{ __html: json }} type="application/ld+json" />;
}
