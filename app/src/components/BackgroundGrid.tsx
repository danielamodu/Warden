/** Fixed dotted-grid backdrop, matching the Manus redesign's `.grid-bg` treatment. */
export default function BackgroundGrid() {
  return <div className="pointer-events-none fixed inset-0 z-0 opacity-70 grid-bg" />;
}
