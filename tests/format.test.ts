import { describe, expect, it } from "vitest";
import { pct, sig, texNum, usd } from "@/lib/format";

describe("display formatting", () => {
  it("percentages, dollars and significant figures", () => {
    expect(pct(0.0158201)).toBe("1.58%");
    expect(usd(537.3593)).toBe("$537.36");
    expect(usd(-19.75)).toBe("−$19.75");
    expect(sig(-0.0197477, 3)).toBe("−0.0197");
  });
  it("plain decimals for LaTeX matrices", () => {
    expect(texNum(0.00098309, 4)).toBe("0.0009831");
    expect(texNum(1234.567, 4)).toBe("1235");
    expect(texNum(1, 4)).toBe("1");
    expect(texNum(-0.5, 4)).toBe("-0.5");
    expect(texNum(3e-17, 4)).toBe("0");
  });
});
