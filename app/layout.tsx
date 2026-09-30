import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: { default: "Portfolio Explorer", template: "%s · Portfolio Explorer" },
  description: "Explore Markowitz portfolio optimisation with real data for the S&P 500, gold and Solana.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Apply the saved theme before first paint (avoids a flash of the wrong theme).
const themeScript = `try{var t=JSON.parse(localStorage.getItem("pe.theme"));if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
