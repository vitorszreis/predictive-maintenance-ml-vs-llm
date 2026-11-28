"""Etapa II: classificação via prompt na amostra fixa.

Uso:
    python -m src.run_llm --dry-run      # mostra o prompt, não chama a API
    python -m src.run_llm --limit 10     # teste com 10 casos, não salva nada
    python -m src.run_llm                # k = 0, 3, 5, 10, 20
    python -m src.run_llm --k 0 5 --provider deepseek

Respostas em cache em data/processed/llm_cache/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone

import pandas as pd
from tqdm import tqdm

from src import config as C
from src.data import load_splits
from src.llm.prompts import PROMPT_VERSION, build_messages, select_few_shot
from src.llm.providers import LLMClient, parse_answer
from src.metrics import append_summary, compute_metrics, plot_confusion, save_json


def price(name: str) -> float:
    return float(os.getenv(name, "0") or 0)


class Cache:
    def __init__(self, provider: str, model: str):
        safe = f"{provider}_{model}".replace("/", "-").replace(":", "-")
        self.path = C.DATA_PROCESSED / "llm_cache" / f"{safe}.jsonl"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = {}
        if self.path.exists():
            for line in self.path.read_text(encoding="utf-8").splitlines():
                rec = json.loads(line)
                self.data[rec["key"]] = rec

    @staticmethod
    def key(system: str, user: str) -> str:
        return hashlib.sha256((system + "\n" + user).encode()).hexdigest()[:24]

    def get(self, key):
        return self.data.get(key)

    def put(self, rec: dict):
        self.data[rec["key"]] = rec
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", nargs="+", type=int, default=C.FEW_SHOT_KS)
    ap.add_argument("--provider")
    ap.add_argument("--model")
    ap.add_argument("--limit", type=int, help="usar só os N primeiros casos da amostra")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    parts = load_splits()
    train, sample = parts["train"], parts["eval_sample"]
    if args.limit:
        sample = sample.head(args.limit)

    if args.dry_run:
        for k in args.k:
            system, user = build_messages(sample.iloc[0], select_few_shot(train, k))
            print(f"\n{'=' * 30} k={k} {'=' * 30}\n[SYSTEM]\n{system}\n\n[USER]\n{user}")
        return

    client = LLMClient(args.provider, args.model)
    cache = Cache(client.provider, client.model)
    p_in, p_out = price("LLM_PRICE_INPUT_PER_MTOK"), price("LLM_PRICE_OUTPUT_PER_MTOK")
    print(f"Provedor={client.provider}  modelo={client.model}  prompt={PROMPT_VERSION}  casos={len(sample)}")

    tag = f"{client.provider}_{client.model}".replace("/", "-").replace(":", "-")
    rows = []
    for k in args.k:
        examples = select_few_shot(train, k)
        preds = []
        for _, row in tqdm(sample.iterrows(), total=len(sample), desc=f"k={k}"):
            system, user = build_messages(row, examples)
            key = Cache.key(system, user)
            rec = cache.get(key)
            if rec is None:
                r = client.complete(system, user)
                rec = {"key": key, "text": r.text, "input_tokens": r.input_tokens,
                       "output_tokens": r.output_tokens, "latency_s": r.latency_s,
                       "ts": datetime.now(timezone.utc).isoformat()}
                cache.put(rec)
            label, prob = parse_answer(rec["text"])
            preds.append({"UDI": row["UDI"], "y_true": int(row[C.TARGET]), "y_pred": label,
                          "prob": prob, "raw": rec["text"], **{c: rec[c] for c in
                          ("input_tokens", "output_tokens", "latency_s")}})

        pred = pd.DataFrame(preds)
        n_invalid = int(pred["y_pred"].isna().sum())
        # resposta inválida conta como "não falha"
        y_pred = pred["y_pred"].fillna(0).astype(int)
        y_score = pred["prob"].fillna(y_pred.astype(float)) if pred["prob"].notna().any() else None
        m = compute_metrics(pred["y_true"], y_pred, y_score)

        tin, tout = int(pred["input_tokens"].sum()), int(pred["output_tokens"].sum())
        cost = tin / 1e6 * p_in + tout / 1e6 * p_out
        setting = "zero-shot" if k == 0 else f"few-shot k={k}"
        m.update({
            "stage": "II", "model": f"{client.provider}:{client.model}", "setting": setting,
            "eval_set": "eval_sample",
            "time_per_100_s": round(pred["latency_s"].mean() * 100, 2),
            "cost_usd": round(cost, 6), "cost_per_100_usd": round(cost / len(pred) * 100, 6),
            "input_tokens": tin, "output_tokens": tout, "invalid_answers": n_invalid,
            "prompt_version": PROMPT_VERSION,
        })
        rows.append(m)
        print(f"   k={k:2d} acc={m['accuracy']:.3f} prec={m['precision']:.3f} rec={m['recall']:.3f} "
              f"f1={m['f1']:.3f} auc={m['roc_auc']} inválidas={n_invalid} "
              f"t/100={m['time_per_100_s']}s custo=${cost:.4f}")
        if args.limit:
            continue

        pred.to_csv(C.RESULTS / f"llm_{tag}_k{k}_predictions.csv", index=False)
        plot_confusion(pred["y_true"], y_pred, f"LLM {setting}", C.FIGURES / f"cm_llm_{tag}_k{k}.png")
        # salva o prompt do 1º caso
        system, user = build_messages(sample.iloc[0], examples)
        prompt_dir = C.RESULTS / "prompts"
        prompt_dir.mkdir(parents=True, exist_ok=True)
        (prompt_dir / f"{PROMPT_VERSION}_k{k}.txt").write_text(
            f"[SYSTEM]\n{system}\n\n[USER]\n{user}\n", encoding="utf-8")

    if args.limit:
        print("\n--limit: teste rápido, nada foi salvo")
        return
    save_json({"provider": client.provider, "model": client.model, "prompt_version": PROMPT_VERSION,
               "run_at": datetime.now(timezone.utc).isoformat(), "price_input_per_mtok": p_in,
               "price_output_per_mtok": p_out, "results": rows}, C.RESULTS / f"llm_{tag}.json")
    append_summary(rows)
    print(f"\nResultados em {C.RESULTS.relative_to(C.ROOT)}")


if __name__ == "__main__":
    main()
