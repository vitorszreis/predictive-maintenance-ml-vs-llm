"""Experimento extra da Etapa II: o LLM com o prompt v2.

Não mexe em summary.csv nem nos resultados do prompt v1: tudo vai para
reports/results/extra/ e reports/figures/extra_*.png.

Variantes (src/llm/prompts_domain.py):
    knn10         few-shot com os 10 vizinhos mais próximos do treino
    derivados     zero-shot com potência, ΔT e desgaste x torque
    regras        zero-shot com as regras de falha da base + derivados   (usa conhecimento de domínio)
    regras_knn10  regras + derivados + 10 vizinhos                       (usa conhecimento de domínio)

Uso:
    python -m src.run_llm_extra --dry-run
    python -m src.run_llm_extra                                   # todas as variantes, deepseek-chat
    python -m src.run_llm_extra --variants regras --model deepseek-reasoner
    python -m src.run_llm_extra --plot-only                       # refaz tabela e gráfico

--tune (padrão: knn10 e regras_knn10) escolhe o limiar da probabilidade numa amostra de
validação tirada do treino (200 casos, 25% falhas) e o aplica na amostra fixa.
"""
from __future__ import annotations

import argparse
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch
import pandas as pd
from sklearn.metrics import f1_score
from tqdm import tqdm

from src import config as C
from src.data import load_splits
from src.llm.prompts_domain import PROMPT_VERSION, VARIANTS, NeighborIndex, build_messages, rule_baseline
from src.llm.providers import LLMClient, parse_answer
from src.metrics import compute_metrics, plot_confusion, save_json
from src.run_llm import Cache, price

OUT = C.RESULTS / "extra"
SUMMARY = OUT / "summary_extra.csv"
TUNE_DEFAULT = ["knn10", "regras_knn10"]


def validation_sample(train: pd.DataFrame) -> pd.DataFrame:
    """Amostra do treino com a mesma composição da amostra fixa, para ajustar o limiar."""
    n_fail = round(C.EVAL_SAMPLE_SIZE * C.EVAL_SAMPLE_FAILURE_RATIO)
    fails = train[train[C.TARGET] == 1].sample(n=n_fail, random_state=C.SEED + 1)
    normal = train[train[C.TARGET] == 0].sample(n=C.EVAL_SAMPLE_SIZE - n_fail, random_state=C.SEED + 1)
    return pd.concat([fails, normal]).sample(frac=1, random_state=C.SEED + 1)


class SafeCache(Cache):
    _lock = threading.Lock()

    def put(self, rec: dict):
        with self._lock:
            super().put(rec)


def run_variant(client, cache, df, v, index, workers) -> pd.DataFrame:
    def one(row):
        system, user = build_messages(row, v, index)
        key = Cache.key(system, user)
        rec = cache.get(key)
        if rec is None:
            r = client.complete(system, user)
            rec = {"key": key, "text": r.text, "input_tokens": r.input_tokens,
                   "output_tokens": r.output_tokens, "latency_s": r.latency_s,
                   "ts": datetime.now(timezone.utc).isoformat()}
            cache.put(rec)
        label, prob = parse_answer(rec["text"])
        return {"UDI": row["UDI"], "y_true": int(row[C.TARGET]), "y_pred": label, "prob": prob,
                "raw": rec["text"], **{c: rec[c] for c in ("input_tokens", "output_tokens", "latency_s")}}

    rows = [r for _, r in df.iterrows()]
    with ThreadPoolExecutor(max_workers=workers) as ex:
        out = list(tqdm(ex.map(one, rows), total=len(rows), desc=v.name))
    return pd.DataFrame(out)


def best_threshold(y_true, prob) -> float:
    grid = np.unique(np.round(prob, 3))
    scores = [(f1_score(y_true, (prob >= t).astype(int), zero_division=0), -t) for t in grid]
    return float(-max(scores)[1])


def metrics_row(pred, client, v, setting, p_in, p_out, y_pred=None, threshold=None):
    n_invalid = int(pred["y_pred"].isna().sum())
    if y_pred is None:
        y_pred = pred["y_pred"].fillna(0).astype(int)
    score = pred["prob"].fillna(pred["y_pred"].fillna(0).astype(float))
    m = compute_metrics(pred["y_true"], y_pred, score)
    tin, tout = int(pred["input_tokens"].sum()), int(pred["output_tokens"].sum())
    cost = tin / 1e6 * p_in + tout / 1e6 * p_out
    m.update({
        "stage": "II-extra", "model": f"{client.provider}:{client.model}", "variant": v.name,
        "setting": setting, "domain_knowledge": v.domain, "eval_set": "eval_sample",
        "threshold": threshold if threshold is not None else 0.5,
        "time_per_100_s": round(pred["latency_s"].mean() * 100, 2),
        "cost_usd": round(cost, 6), "cost_per_100_usd": round(cost / len(pred) * 100, 6),
        "input_tokens": tin, "output_tokens": tout, "invalid_answers": n_invalid,
        "prompt_version": PROMPT_VERSION,
    })
    return m


def append(rows: list[dict]) -> None:
    new = pd.DataFrame(rows)
    keys = ["model", "variant", "setting"]
    if SUMMARY.exists():
        old = pd.read_csv(SUMMARY)
        merged = old.merge(new[keys], on=keys, how="left", indicator=True)
        new = pd.concat([old[merged["_merge"] == "left_only"], new], ignore_index=True)
    new.to_csv(SUMMARY, index=False)


def rules_reference(sample: pd.DataFrame) -> list[dict]:
    rows = []
    for with_twf, name in [(False, "regras sem LLM"), (True, "regras sem LLM (com faixa de desgaste)")]:
        y = rule_baseline(sample, with_twf)
        m = compute_metrics(sample[C.TARGET], y, None)
        m.update({"stage": "referência", "model": "regras da documentação", "variant": "regras_python",
                  "setting": name, "domain_knowledge": True, "eval_set": "eval_sample", "threshold": None,
                  "time_per_100_s": 0.0, "cost_usd": 0.0, "prompt_version": "-"})
        rows.append(m)
    return rows


def plot() -> None:
    ex = pd.read_csv(SUMMARY)
    base = pd.read_csv(C.RESULTS / "summary.csv")
    base = base[base["eval_set"] == "eval_sample"]
    cls = base[(base["stage"] == "I") & (base["setting"] == "balance=smote")]
    best_cls = cls.sort_values("f1", ascending=False)
    v1 = base[(base["stage"] == "II") & base["setting"].isin(["zero-shot", "few-shot k=10"])]

    items = []
    for _, r in best_cls.iterrows():
        items.append((f"{r['model'].upper()} (Etapa I)", r["f1"], "#4C72B0"))
    for _, r in v1.iterrows():
        items.append((f"LLM v1 {r['setting']}", r["f1"], "#DD8452"))
    order = ["knn10", "derivados", "regras", "regras_knn10"]
    ex = ex.copy()
    ex["o"] = ex["variant"].map({k: i for i, k in enumerate(order)}).fillna(9)
    for _, r in ex.sort_values(["o", "setting"]).iterrows():
        if r["stage"] == "referência":
            continue
        model = r["model"].split(":")[-1]
        color = "#C44E52" if r["domain_knowledge"] else "#55A868"
        items.append((f"LLM v2 {r['setting']}" + ("" if model == "deepseek-chat" else f" [{model}]"), r["f1"], color))
    ref = ex[ex["variant"] == "regras_python"]
    for _, r in ref.iterrows():
        if "desgaste" not in r["setting"]:
            items.append(("Só as regras, sem LLM", r["f1"], "#8C8C8C"))

    labels, vals, colors = zip(*items, strict=True)
    fig, ax = plt.subplots(figsize=(8, 0.36 * len(items) + 1.4))
    ax.barh(labels, vals, color=colors)
    for i, val in enumerate(vals):
        ax.text(val + 0.01, i, f"{val:.2f}", va="center", fontsize=8)
    ax.invert_yaxis()
    ax.set_xlim(0, 1.05)
    ax.set_xlabel("F1 (classe falha) na amostra fixa de 200 casos")
    ax.legend(handles=[Patch(color="#4C72B0", label="Clássicos"),
                       Patch(color="#DD8452", label="LLM, prompt original"),
                       Patch(color="#55A868", label="LLM v2, só dados de treino"),
                       Patch(color="#C44E52", label="LLM v2, com regras de domínio"),
                       Patch(color="#8C8C8C", label="Regras, sem LLM")],
              loc="lower right", fontsize=7)
    fig.tight_layout()
    C.FIGURES.mkdir(parents=True, exist_ok=True)
    fig.savefig(C.FIGURES / "extra_f1.png", dpi=150)
    plt.close(fig)

    cols = ["stage", "model", "setting", "domain_knowledge", "threshold", "accuracy", "precision",
            "recall", "f1", "roc_auc", "fp", "fn", "time_per_100_s", "cost_per_100_usd", "invalid_answers"]
    md = ["# Experimento extra: prompt v2 (amostra fixa, 200 casos)", "",
          ex[[c for c in cols if c in ex.columns]].to_markdown(index=False, floatfmt=".3f")]
    (OUT / "comparison_extra.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", nargs="+", default=list(VARIANTS), choices=list(VARIANTS))
    ap.add_argument("--provider")
    ap.add_argument("--model")
    ap.add_argument("--tune", nargs="*", default=None, help="variantes com ajuste de limiar")
    ap.add_argument("--workers", type=int, default=int(os.getenv("LLM_WORKERS", "8")))
    ap.add_argument("--limit", type=int)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--plot-only", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if args.plot_only:
        return plot()

    parts = load_splits()
    train, sample = parts["train"], parts["eval_sample"]
    if args.limit:
        sample = sample.head(args.limit)
    index = NeighborIndex(train)
    tune = TUNE_DEFAULT if args.tune is None else args.tune

    if args.dry_run:
        for name in args.variants:
            system, user = build_messages(sample.iloc[0], VARIANTS[name], index)
            print(f"\n{'=' * 30} {name} {'=' * 30}\n[SYSTEM]\n{system}\n\n[USER]\n{user}")
        return

    client = LLMClient(args.provider, args.model)
    cache = SafeCache(client.provider, client.model)
    p_in, p_out = price("LLM_PRICE_INPUT_PER_MTOK"), price("LLM_PRICE_OUTPUT_PER_MTOK")
    tag = f"{client.provider}_{client.model}".replace("/", "-").replace(":", "-")
    print(f"Provedor={client.provider}  modelo={client.model}  prompt={PROMPT_VERSION}  casos={len(sample)}")

    rows = []
    for name in args.variants:
        v = VARIANTS[name]
        pred = run_variant(client, cache, sample, v, index, args.workers)
        m = metrics_row(pred, client, v, v.label, p_in, p_out)
        rows.append(m)
        print(f"   {name:13s} prec={m['precision']:.3f} rec={m['recall']:.3f} f1={m['f1']:.3f} "
              f"auc={m['roc_auc']} fp={m['fp']} fn={m['fn']} inválidas={m['invalid_answers']}")
        pred.to_csv(OUT / f"{tag}_{name}_predictions.csv", index=False)
        plot_confusion(pred["y_true"], pred["y_pred"].fillna(0).astype(int), f"LLM v2 {v.label}",
                       C.FIGURES / f"extra_cm_{tag}_{name}.png")
        system, user = build_messages(sample.iloc[0], v, index)
        (OUT / "prompts").mkdir(exist_ok=True)
        (OUT / "prompts" / f"{PROMPT_VERSION}_{name}.txt").write_text(
            f"[SYSTEM]\n{system}\n\n[USER]\n{user}\n", encoding="utf-8")

        if name in tune and not args.limit:
            val = validation_sample(train)
            vpred = run_variant(client, cache, val, v, index, args.workers)
            vprob = vpred["prob"].fillna(vpred["y_pred"].fillna(0).astype(float)).to_numpy()
            t = best_threshold(vpred["y_true"].to_numpy(), vprob)
            prob = pred["prob"].fillna(pred["y_pred"].fillna(0).astype(float)).to_numpy()
            mt = metrics_row(pred, client, v, f"{v.label}, limiar {t:.2f}", p_in, p_out,
                             y_pred=(prob >= t).astype(int), threshold=t)
            mt["val_f1_at_threshold"] = round(f1_score(vpred["y_true"], (vprob >= t).astype(int)), 4)
            rows.append(mt)
            vpred.to_csv(OUT / f"{tag}_{name}_validation_predictions.csv", index=False)
            print(f"   {name:13s} limiar={t:.2f} (validação f1={mt['val_f1_at_threshold']:.3f}) "
                  f"-> amostra f1={mt['f1']:.3f} prec={mt['precision']:.3f} rec={mt['recall']:.3f}")

    if not args.limit:
        append(rows + rules_reference(parts["eval_sample"]))
        save_json({"provider": client.provider, "model": client.model, "prompt_version": PROMPT_VERSION,
                   "run_at": datetime.now(timezone.utc).isoformat(), "price_input_per_mtok": p_in,
                   "price_output_per_mtok": p_out, "results": rows}, OUT / f"llm_extra_{tag}.json")
        plot()
    print(f"\nResultados em {OUT.relative_to(C.ROOT)}")


if __name__ == "__main__":
    main()
