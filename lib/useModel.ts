"use client";
import { useMemo } from "react";
import { useData } from "@/components/providers";
import {
  analysePrices,
  asymptotes,
  lagrangeConstants,
  linearWeightForm,
  minimumVariancePortfolio,
  zeroCrossings,
} from "@/lib/math";

/** Everything the pages need, computed in the browser from the current data. */
export function useModel(window?: { dropStart?: number; dropEnd?: number }) {
  const data = useData();
  return useMemo(() => {
    const a = window?.dropStart ?? 0;
    const b = data.months.length - (window?.dropEnd ?? 0);
    const months = data.months.slice(a, b);
    const prices = data.prices.map((p) => p.slice(a, b));
    const stats = analysePrices(prices);
    const k = lagrangeConstants(stats.Sigma, stats.means);
    return {
      months,
      returnMonths: months.slice(1),
      prices,
      stats,
      k,
      mvp: minimumVariancePortfolio(k),
      linear: linearWeightForm(k),
      zeros: zeroCrossings(k),
      asym: asymptotes(k),
    };
  }, [data.months, data.prices, window?.dropStart, window?.dropEnd]);
}
