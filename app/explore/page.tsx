"use client";
import { AverageTruth } from "@/components/explore/AverageTruth";
import { Frontier } from "@/components/explore/Frontier";
import { LinearWeights } from "@/components/explore/LinearWeights";
import { ShortSelling } from "@/components/explore/ShortSelling";
import { SolanaShort } from "@/components/explore/SolanaShort";
import { WhatIf } from "@/components/explore/WhatIf";
import { Investigation, PageHeader, Question } from "@/components/pattern/Stages";

const INVESTIGATIONS = [
  { title: "Linear weights", q: "As you ask for more return, how does each weight change?", C: LinearWeights },
  { title: "When does short-selling start?", q: "For which target returns can the minimum-risk portfolio be built without short-selling?", C: ShortSelling },
  { title: "The shape of the trade-off", q: "What shape is the risk–return trade-off, and what does its slope mean?", C: Frontier },
  { title: "The Solana short", q: "Why does the safest portfolio bet against the asset with the highest return?", C: SolanaShort },
  { title: "What-if lab", q: "How much does the answer move if the inputs change a little?", C: WhatIf },
  { title: "Is the average telling the truth?", q: "The model promises an average return. Is that what an investor actually gets?", C: AverageTruth },
];

export default function ExplorePage() {
  return (
    <>
      <PageHeader n={8} title="Exploring the solution" lead="Six investigations into what the formula w = g + hμ* actually says. Together they answer the research question." />
      <nav aria-label="Investigations" className="stage">
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {INVESTIGATIONS.map((inv, i) => (
            <li key={inv.title}><a href={`#investigation-${i + 1}`}>{inv.title}</a></li>
          ))}
        </ol>
      </nav>
      {INVESTIGATIONS.map(({ title, q, C }, i) => (
        <Investigation key={title} n={i + 1} title={title}>
          <Question>{q}</Question>
          <C />
        </Investigation>
      ))}
    </>
  );
}
