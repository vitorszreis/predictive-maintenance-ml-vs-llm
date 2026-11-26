"""Comparação final clássicos x LLM na mesma amostra (eval_sample).

Uso:
    python -m src.compare     # gera reports/results/comparison.md e reports/figures/comparison_f1.png
"""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from src import config as C

COLS = ["stage", "model", "setting", "accuracy", "precision", "recall", "f1", "roc_auc",
        "time_per_100_s", "cost_usd"]


def main() -> None:
    path = C.RESULTS / "summary.csv"
    if not path.exists():
        raise SystemExit("Rode antes: python -m src.train_classical e python -m src.run_llm")
    df = pd.read_csv(path)
    df = df[df["eval_set"] == "eval_sample"].copy()
    if df.empty:
        raise SystemExit("Nenhum resultado na amostra fixa (eval_sample) ainda.")
    df = df.sort_values(["stage", "f1"], ascending=[True, False])
    table = df[[c for c in COLS if c in df.columns]]

    md = ["# Comparação na amostra fixa de avaliação", "",
          f"Amostra: {int(df['n'].iloc[0])} casos do conjunto de teste "
          f"({C.EVAL_SAMPLE_FAILURE_RATIO:.0%} falhas). Gerado por `python -m src.compare`.", "",
          table.to_markdown(index=False, floatfmt=".3f")]
    out = C.RESULTS / "comparison.md"
    out.write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))

    labels = (df["model"] + " | " + df["setting"].str.replace("balance=", "")).tolist()
    colors = ["#4C72B0" if s == "I" else "#DD8452" for s in df["stage"]]
    fig, ax = plt.subplots(figsize=(8, 0.4 * len(df) + 1.5))
    ax.barh(labels, df["f1"], color=colors)
    ax.invert_yaxis()
    ax.set_xlabel("F1 (classe falha)")
    ax.set_xlim(0, 1)
    ax.set_title("Clássicos (azul) x LLM (laranja) - amostra fixa")
    fig.tight_layout()
    C.FIGURES.mkdir(parents=True, exist_ok=True)
    fig.savefig(C.FIGURES / "comparison_f1.png", dpi=150)
    print(f"\nSalvo em {out.relative_to(C.ROOT)} e {(C.FIGURES / 'comparison_f1.png').relative_to(C.ROOT)}")


if __name__ == "__main__":
    main()
