/** KaTeX is loaded from the jsDelivr CDN by a <script> tag in Index.html (saves ~260 KB). */
declare global {
  interface Window {
    katex: typeof import("katex").default;
  }
}
const katex = window.katex;
export default katex;
