"""Carga, limpeza e divisão da base. `python -m src.data` gera data/processed/."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from src import config as C


def load_raw() -> pd.DataFrame:
    if not C.DATA_RAW.exists():
        raise FileNotFoundError(
            f"Base não encontrada em {C.DATA_RAW}. Rode: python scripts/download_data.py"
        )
    return pd.read_csv(C.DATA_RAW, encoding="utf-8-sig")


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    n0 = len(df)
    df = df.drop_duplicates(subset="UDI")
    assert df[C.NUMERIC_COLS + C.CATEGORICAL_COLS + [C.TARGET]].notna().all().all(), "Há valores nulos"
    df["Type"] = df["Type"].astype("category")
    df[C.TARGET] = df[C.TARGET].astype(int)
    if len(df) != n0:
        print(f"[clean] {n0 - len(df)} duplicatas removidas")
    return df


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Atributos ligados às falhas por calor (HDF), potência (PWF) e sobrecarga (OSF)."""
    df = df.copy()
    df["Temp diff [K]"] = df["Process temperature [K]"] - df["Air temperature [K]"]
    df["Power [W]"] = df["Torque [Nm]"] * df["Rotational speed [rpm]"] * 2 * np.pi / 60
    df["Strain [min*Nm]"] = df["Tool wear [min]"] * df["Torque [Nm]"]
    return df


def feature_columns(engineered: bool = C.USE_ENGINEERED_FEATURES) -> tuple[list[str], list[str]]:
    num = list(C.NUMERIC_COLS)
    if engineered:
        num += ["Temp diff [K]", "Power [W]", "Strain [min*Nm]"]
    return num, list(C.CATEGORICAL_COLS)


def split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    return train_test_split(
        df, test_size=C.TEST_SIZE, stratify=df[C.TARGET], random_state=C.SEED
    )


def eval_sample(test: pd.DataFrame) -> pd.DataFrame:
    n_fail = round(C.EVAL_SAMPLE_SIZE * C.EVAL_SAMPLE_FAILURE_RATIO)
    fails = test[test[C.TARGET] == 1]
    n_fail = min(n_fail, len(fails))
    normal = test[test[C.TARGET] == 0]
    sample = pd.concat([
        fails.sample(n=n_fail, random_state=C.SEED),
        normal.sample(n=C.EVAL_SAMPLE_SIZE - n_fail, random_state=C.SEED),
    ])
    return sample.sample(frac=1, random_state=C.SEED)  # embaralha


def prepare(save: bool = True) -> dict[str, pd.DataFrame]:
    df = clean(load_raw())
    df = add_engineered_features(df)
    train, test = split(df)
    sample = eval_sample(test)
    out = {"train": train, "test": test, "eval_sample": sample}
    if save:
        C.DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
        for name, part in out.items():
            part.to_csv(C.DATA_PROCESSED / f"{name}.csv", index=False)
    return out


def load_splits() -> dict[str, pd.DataFrame]:
    paths = {n: C.DATA_PROCESSED / f"{n}.csv" for n in ("train", "test", "eval_sample")}
    if not all(p.exists() for p in paths.values()):
        return prepare(save=True)
    return {n: pd.read_csv(p) for n, p in paths.items()}


def summary(parts: dict[str, pd.DataFrame]) -> None:
    for name, part in parts.items():
        pos = part[C.TARGET].sum()
        print(f"{name:12s} n={len(part):5d}  falhas={pos:4d} ({pos / len(part):.1%})")


if __name__ == "__main__":
    parts = prepare(save=True)
    summary(parts)
    print(f"Arquivos salvos em {C.DATA_PROCESSED.relative_to(C.ROOT)}")
