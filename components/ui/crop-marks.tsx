/** Printer's crop marks in the four corners of the page. They mark the edge of the "sheet". */
export function CropMarks() {
  const arm = 'absolute bg-ink/45';
  const corner = 'pointer-events-none absolute h-7 w-7';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-3 sm:inset-5">
      <span className={`${corner} left-0 top-0`}>
        <i className={`${arm} left-0 top-3 h-px w-full`} />
        <i className={`${arm} left-3 top-0 h-full w-px`} />
      </span>
      <span className={`${corner} right-0 top-0`}>
        <i className={`${arm} left-0 top-3 h-px w-full`} />
        <i className={`${arm} right-3 top-0 h-full w-px`} />
      </span>
      <span className={`${corner} bottom-0 left-0`}>
        <i className={`${arm} left-0 bottom-3 h-px w-full`} />
        <i className={`${arm} left-3 top-0 h-full w-px`} />
      </span>
      <span className={`${corner} bottom-0 right-0`}>
        <i className={`${arm} left-0 bottom-3 h-px w-full`} />
        <i className={`${arm} right-3 top-0 h-full w-px`} />
      </span>
    </div>
  );
}
