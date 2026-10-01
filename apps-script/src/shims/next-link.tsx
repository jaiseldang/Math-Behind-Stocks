/** Stand-in for next/link: a plain link to the hash route. */
import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href.startsWith("/") ? `#${href}` : href} {...rest} />;
}
