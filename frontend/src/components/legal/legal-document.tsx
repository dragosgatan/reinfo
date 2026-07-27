import type { LegalDoc } from "@/lib/legal-content";

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

interface LegalDocumentProps {
  doc: LegalDoc;
}

export function LegalDocument({ doc }: LegalDocumentProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{doc.lastUpdated}</p>

      <div className="mt-8 space-y-2">
        {doc.intro.map((paragraph, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {renderInline(paragraph)}
          </p>
        ))}
      </div>

      <div className="mt-10 space-y-10">
        {doc.sections.map((section, i) => (
          <section key={i}>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph, j) => (
              <p key={j} className="mt-3 text-sm leading-relaxed text-foreground/90">
                {renderInline(paragraph)}
              </p>
            ))}
            {section.list && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
                {section.list.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
