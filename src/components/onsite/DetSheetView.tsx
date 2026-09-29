import { type DetSheet, personLabel } from '../../io/detSheet';
import { listName } from '../../model';
import './det-sheet.css';

/** A4 list of one detachement or sub-group. Always rendered light, like paper. */
export function DetSheetView({ sheet }: { sheet: DetSheet }) {
  const span = 3 + sheet.columns.length + (sheet.checkColumn ? 1 : 0);
  const printed = new Date().toLocaleDateString('de-CH');
  return (
    <article className="det-sheet" aria-label={`Liste ${sheet.title}`}>
      <header className="det-sheet-head">
        <div>
          <p className="det-sheet-eyebrow">
            {[sheet.unit, sheet.service].filter(Boolean).join(' · ')}
          </p>
          <h2>{sheet.title}</h2>
        </div>
        {sheet.ec && <span className="det-sheet-ec">EC {sheet.ec}</span>}
      </header>
      <dl className="det-sheet-facts">
        {sheet.details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div>
          <dt>Bestand</dt>
          <dd>
            <strong>{sheet.total}</strong>
            {sheet.bestand && ` · ${sheet.bestand}`}
          </dd>
        </div>
        {sheet.licenses.length > 0 && (
          <div>
            <dt>Fahrausweise</dt>
            <dd>{sheet.licenses.map(([license, count]) => `${license}: ${count}`).join(' · ')}</dd>
          </div>
        )}
      </dl>
      {sheet.sections.map((section, index) => (
        <section
          key={section.id}
          className={`det-sheet-section ${sheet.pageBreaks && index > 0 ? 'is-break' : ''}`}
        >
          {section.title && (
            <header className="det-sheet-section-head">
              <h3>{section.title}</h3>
              <span>
                {section.people.length} Pers.{section.bestand && ` · ${section.bestand}`}
              </span>
              {(section.chef || section.auftrag) && (
                <p>
                  {section.chef && (
                    <>
                      Chef: <strong>{personLabel(section.chef)}</strong>
                    </>
                  )}
                  {section.chef && section.auftrag && ' · '}
                  {section.auftrag && `Auftrag: ${section.auftrag}`}
                </p>
              )}
            </header>
          )}
          <table className="det-sheet-table">
            <thead>
              <tr>
                <th className="num">Nr.</th>
                <th className="det-sheet-grad">Grad</th>
                <th className="det-sheet-name">Name</th>
                {sheet.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                {sheet.checkColumn && (
                  <th className="det-sheet-check" title="Anwesend">
                    ✓
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {section.people.map((person, row) => (
                <tr
                  key={person.id}
                  className={section.chef?.id === person.id ? 'is-chef' : undefined}
                >
                  <td className="num">{row + 1}</td>
                  <td>{person.grad}</td>
                  <td>
                    <strong>{listName(person)}</strong>
                    {section.chef?.id === person.id && <span className="det-sheet-tag">Chef</span>}
                  </td>
                  {sheet.columns.map((column) => (
                    <td key={column.key}>{column.value(person)}</td>
                  ))}
                  {sheet.checkColumn && (
                    <td className="det-sheet-check">
                      <span className="det-sheet-box" />
                    </td>
                  )}
                </tr>
              ))}
              {!section.people.length && (
                <tr>
                  <td colSpan={span} className="det-sheet-empty">
                    Noch niemand eingeteilt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ))}
      <footer className="det-sheet-foot">
        Stand {printed} · Enthält Personendaten – nur für den dienstlichen Gebrauch.
      </footer>
    </article>
  );
}

let activeCleanup: (() => void) | undefined;
/** Prints only the mounted sheet; the title becomes the proposed PDF file name. */
export function printDetSheet(sheet: DetSheet): void {
  activeCleanup?.();
  const root = document.documentElement,
    previousTitle = document.title;
  const style = document.createElement('style');
  style.textContent = '@page { size: A4 portrait; margin: 12mm; }';
  document.head.append(style);
  root.classList.add('det-print');
  document.title = sheet.fileStem;
  const cleanup = () => {
    if (activeCleanup !== cleanup) return;
    activeCleanup = undefined;
    window.removeEventListener('afterprint', cleanup);
    root.classList.remove('det-print');
    style.remove();
    document.title = previousTitle;
  };
  activeCleanup = cleanup;
  window.addEventListener('afterprint', cleanup);
  try {
    window.print();
  } catch {
    cleanup();
  }
}
