export interface PageInfo {
  href: string;
  title: string;
  short: string;
}

export const PAGES: PageInfo[] = [
  { href: "/", title: "The problem", short: "Home: the problem" },
  { href: "/data", title: "Data & provenance", short: "Data & provenance" },
  { href: "/returns", title: "Returns", short: "Returns" },
  { href: "/risk", title: "Risk & correlation", short: "Risk & correlation" },
  { href: "/matrices", title: "Why matrices", short: "Why matrices" },
  { href: "/lagrange", title: "Lagrange multipliers: the idea", short: "Lagrange: the idea" },
  { href: "/solving", title: "Solving it", short: "Solving it" },
  { href: "/explore", title: "Exploring the solution", short: "Exploring the solution" },
  { href: "/limitations", title: "Limitations", short: "Limitations" },
  { href: "/write-up", title: "For my write-up", short: "For my write-up" },
];

export const EXTRA_PAGES: PageInfo[] = [
  { href: "/glossary", title: "Glossary & notation", short: "Glossary & notation" },
  { href: "/api-docs", title: "API documentation", short: "API docs" },
];
