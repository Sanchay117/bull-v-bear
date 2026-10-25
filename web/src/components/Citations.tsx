import { createContext, useContext, type ReactNode } from "react";
import { citationPattern, citedLetters } from "@court/core";

export const ExhibitFocus = createContext<{ focus: string | null; setFocus: (id: string | null) => void }>({
  focus: null,
  setFocus: () => {},
});

function CiteChip({ id }: { id: string }) {
  const { focus, setFocus } = useContext(ExhibitFocus);
  return (
    <button
      type="button"
      className={`cite ${focus === id ? "is-focus" : ""}`}
      onMouseEnter={() => setFocus(id)}
      onMouseLeave={() => setFocus(null)}
      onFocus={() => setFocus(id)}
      onBlur={() => setFocus(null)}
      onClick={() => document.getElementById(`exhibit-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })}
      aria-label={`Exhibit ${id}`}
    >
      {id}
    </button>
  );
}

/** Renders counsel's text with [Ex. X] citations turned into exhibit chips. */
export function WithCitations({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(citationPattern())) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const ids = citedLetters(m);
    out.push(
      <span className="cite-group" key={`${at}`}>
        <span className="cite-ex">Ex.</span>
        {ids.map((id) => (
          <CiteChip id={id} key={id} />
        ))}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
