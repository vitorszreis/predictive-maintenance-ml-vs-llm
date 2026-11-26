"""Etapa I: SVM e MLP, com Random Forest e XGBoost como referência.

Pipeline de cada modelo, ajustado dentro da validação cruzada:
    one-hot(Type) + z-score  ->  SMOTE  ->  modelo

Uso:
    python -m src.train_classical                    # todos os modelos
    python -m src.train_classical --models svm mlp   # só alguns
    python -m src.train_classical --balance class_weight
    python -m src.train_classical --quick            # grades mínimas, para testar

As variações (--balance, --engineered, --quick) gravam seus arquivos com sufixo, sem
sobrescrever a configuração principal. O --quick não entra no summary.csv.
"""
from __future__ import annotations

import argparse
import json
import time

import joblib
import numpy as np
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV, StratifiedKFold
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from xgboost import XGBClassifier

from src import config as C
from src.data import feature_columns, load_splits
from src.metrics import append_summary, compute_metrics, plot_confusion, plot_roc, save_json


def build_preprocessor(num_cols, cat_cols) -> ColumnTransformer:
    return ColumnTransformer([
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ])


def model_specs(balance: str, pos_weight: float, quick: bool) -> dict:
    """Modelo base + grade de hiperparâmetros. Prefixo 'clf__' = passo do pipeline."""
    cw = "balanced" if balance == "class_weight" else None
    specs = {
        "svm": (
            SVC(kernel="rbf", class_weight=cw, random_state=C.SEED),
            {"clf__C": [0.1, 1, 10, 100], "clf__gamma": ["scale", 0.1, 0.01]},
        ),
        "mlp": (
            # MLPClassifier não tem class_weight: com balance=class_weight, treina sem balanceamento.
            MLPClassifier(max_iter=500, early_stopping=True, random_state=C.SEED),
            {
                "clf__hidden_layer_sizes": [(16,), (32,), (32, 16), (64, 32)],
                "clf__alpha": [1e-4, 1e-3, 1e-2],
                "clf__learning_rate_init": [1e-3, 1e-2],
            },
        ),
        "rf": (
            RandomForestClassifier(class_weight=cw, n_jobs=-1, random_state=C.SEED),
            {"clf__n_estimators": [200, 500], "clf__max_depth": [None, 10, 20]},
        ),
        "xgb": (
            XGBClassifier(
                eval_metric="logloss", n_jobs=-1, random_state=C.SEED,
                scale_pos_weight=pos_weight if balance == "class_weight" else 1.0,
            ),
            {"clf__n_estimators": [200, 500], "clf__max_depth": [3, 6], "clf__learning_rate": [0.05, 0.1]},
        ),
    }
    if quick:  # 1 combinação por modelo
        specs = {k: (m, {p: v[:1] for p, v in g.items()}) for k, (m, g) in specs.items()}
    return specs


def score_of(model, X) -> np.ndarray:
    """Escore contínuo da classe 'falha' para AUC-ROC."""
    if hasattr(model, "predict_proba"):
        try:
            return model.predict_proba(X)[:, 1]
        except AttributeError:  # SVC sem probability=True
            pass
    return model.decision_function(X)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", default=["svm", "mlp", "rf", "xgb"])
    ap.add_argument("--balance", choices=["smote", "class_weight", "none"], default="smote")
    ap.add_argument("--engineered", action="store_true", help="usar atributos derivados")
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--cv", type=int, default=5)
    args = ap.parse_args()

    parts = load_splits()
    num_cols, cat_cols = feature_columns(engineered=args.engineered)
    cols = num_cols + cat_cols
    train, test, sample = parts["train"], parts["test"], parts["eval_sample"]
    X_tr, y_tr = train[cols], train[C.TARGET]
    pos_weight = float((y_tr == 0).sum() / (y_tr == 1).sum())

    setting = f"balance={args.balance}" + (",engineered" if args.engineered else "")
    variant = [args.balance] if args.balance != "smote" else []
    variant += ["engineered"] if args.engineered else []
    variant += ["quick"] if args.quick else []
    tag = "".join(f"_{v}" for v in variant)
    cv = StratifiedKFold(n_splits=args.cv, shuffle=True, random_state=C.SEED)
    rows, roc_test = [], {}

    for name, (clf, grid) in model_specs(args.balance, pos_weight, args.quick).items():
        if name not in args.models:
            continue
        steps = [("prep", build_preprocessor(num_cols, cat_cols))]
        if args.balance == "smote":
            steps.append(("smote", SMOTE(random_state=C.SEED)))
        steps.append(("clf", clf))
        search = GridSearchCV(Pipeline(steps), grid, scoring="f1", cv=cv, n_jobs=-1)

        t0 = time.perf_counter()
        search.fit(X_tr, y_tr)
        fit_s = time.perf_counter() - t0
        best = search.best_estimator_
        print(f"\n[{name}] melhor F1 (CV) = {search.best_score_:.3f}  params = {search.best_params_}  ({fit_s:.0f}s)")

        for eval_name, df in (("test_full", test), ("eval_sample", sample)):
            X, y = df[cols], df[C.TARGET]
            t0 = time.perf_counter()
            y_pred = best.predict(X)
            pred_s = time.perf_counter() - t0
            y_score = score_of(best, X)
            m = compute_metrics(y, y_pred, y_score)
            m.update({
                "stage": "I", "model": name, "setting": setting, "eval_set": eval_name,
                "time_per_100_s": round(pred_s / len(X) * 100, 6), "cost_usd": 0.0,
                "cv_f1": round(search.best_score_, 4), "fit_time_s": round(fit_s, 1),
                "best_params": json.dumps(search.best_params_, default=str),
            })
            rows.append(m)
            print(f"   {eval_name:11s} acc={m['accuracy']:.3f} prec={m['precision']:.3f} "
                  f"rec={m['recall']:.3f} f1={m['f1']:.3f} auc={m['roc_auc']}")
            plot_confusion(y, y_pred, f"{name.upper()} ({eval_name})",
                           C.FIGURES / f"cm_{name}_{eval_name}{tag}.png")
            if eval_name == "test_full":
                roc_test[name.upper()] = (y, y_score)

        joblib.dump(best, C.RESULTS / f"model_{name}{tag}.joblib")
        save_json({"best_params": search.best_params_, "cv_f1": search.best_score_},
                  C.RESULTS / f"classical_{name}{tag}.json")

    if roc_test:
        plot_roc(roc_test, "Curva ROC - teste completo", C.FIGURES / f"roc_classical{tag}.png")
    if args.quick:
        print("\n--quick: resultados de teste, fora do summary.csv")
        return
    table = append_summary(rows)
    print(f"\nResumo salvo em {(C.RESULTS / 'summary.csv').relative_to(C.ROOT)} ({len(table)} linhas)")


if __name__ == "__main__":
    main()
