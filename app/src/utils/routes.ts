// Routes that get the marketing chrome (Docs/Privacy/Terms nav + footer)
// instead of the in-app chrome (Fund escrow/Vaults/Proof, no footer).
// Landing is the homepage; Docs/Terms/Privacy are reached from it (and from
// each other) and share its footer links, so they get the same chrome
// rather than the app-flow one. Shared by NavBar and Footer so the two stay
// in sync by construction instead of by two hand-kept lists.
const MARKETING_ROUTES = new Set(['/', '/docs', '/terms', '/privacy']);

export function isMarketingRoute(pathname: string): boolean {
  return MARKETING_ROUTES.has(pathname);
}
