"""Tabela e gráfico finais: clássicos x LLM na amostra fixa."""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import Patch

from src import config as C

COLS = ["stage", "model", "setting", "accuracy", "precision", "recall", "f1", "roc_auc",
        "time_per_100_s", "cost_usd"]

# cores validadas para daltonismo (azul, laranja, verde-água) e cinza para a referência
GROUPS = {
    "Clássico": "#257de0",
    "LLM, prompt simples": "#f47230",
    "LLM, prompt melhorado": "#00b894",
    "Referência": "#9a9a9a",
}
INK, INK2 = "#191919", "#666666"


def plot_headline(base: pd.DataFrame) -> None:
    """Figura do README: o melhor de cada abordagem."""
    cls = base[(base["stage"] == "I") & (base["setting"] == "balance=smote")]
    best = cls["f1"].max()
    names = " / ".join(m.upper() for m in cls.loc[cls["f1"] == best, "model"])
    llm = base[base["stage"] == "II"]
    fs = llm[llm["setting"] != "zero-shot"].sort_values("f1").iloc[-1]
    bars = [
        (f"Clássico ({names})", best, "Clássico"),
        ("LLM zero-shot", llm.loc[llm["setting"] == "zero-shot", "f1"].iloc[0], "LLM, prompt simples"),
        (f"LLM few-shot ({fs['setting'].split('=')[1]} exemplos)", fs["f1"], "LLM, prompt simples"),
    ]
    extra = C.RESULTS / "extra" / "summary_extra.csv"
    if extra.exists():
        ex = pd.read_csv(extra)
        llm2 = ex[ex["stage"] == "II-extra"]
        no_dom = llm2[~llm2["domain_knowledge"]]["f1"].max()
        dom = llm2[llm2["domain_knowledge"]]["f1"].max()
        rules = ex.loc[ex["setting"] == "regras sem LLM", "f1"].iloc[0]
        bars += [
            ("LLM com exemplos vizinhos", no_dom, "LLM, prompt melhorado"),
            ("LLM com regras de falha no prompt", dom, "LLM, prompt melhorado"),
            ("Só as regras de falha, sem modelo", rules, "Referência"),
        ]

    labels, vals, groups = zip(*bars, strict=True)
    fig, ax = plt.subplots(figsize=(8, 0.42 * len(bars) + 1.3))
    ax.barh(labels, vals, height=0.5, color=[GROUPS[g] for g in groups])
    for i, v in enumerate(vals):
        ax.text(v + 0.012, i, f"{v:.2f}".replace(".", ","), va="center", fontsize=10, color=INK)
    ax.invert_yaxis()
    ax.set_xlim(0, 1.05)
    ax.set_xticks([])
    for side in ("top", "right", "bottom"):
        ax.spines[side].set_visible(False)
    ax.spines["left"].set_color("#d0d0d0")
    ax.tick_params(axis="y", length=0, labelsize=10, labelcolor=INK)
    ax.set_title("F1 na detecção de falhas: 200 ciclos de teste, 50 com falha",
                 loc="left", fontsize=11, color=INK, pad=10)
    used = list(dict.fromkeys(groups))
    fig.legend(handles=[Patch(color=GROUPS[g], label=g) for g in used], ncol=len(used),
               loc="lower center", frameon=False, fontsize=8, labelcolor=INK2,
               handlelength=1, columnspacing=1.5)
    fig.tight_layout(rect=(0, 0.07, 1, 1))
    fig.savefig(C.FIGURES / "resumo_f1.png", dpi=150, facecolor="white")
    plt.close(fig)


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
    plt.close(fig)
    plot_headline(df)
    print(f"\nSalvo em {out.relative_to(C.ROOT)} e {(C.FIGURES / 'comparison_f1.png').relative_to(C.ROOT)}")


if __name__ == "__main__":
    main()
