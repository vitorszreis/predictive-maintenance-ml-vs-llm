"""Prompt v2 (experimento extra): atributos derivados, regras de falha e exemplos por vizinhança."""
from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from src import config as C
from src.llm.prompts import SYSTEM_PROMPT as SYSTEM_V1

PROMPT_VERSION = "v2"

OUTPUT_FORMAT = """Responda SOMENTE com um JSON de uma linha, sem texto antes ou depois, no formato:
{"falha": 0 ou 1, "probabilidade": número entre 0 e 1 com a sua confiança de que haverá falha}"""

ATTRS = """Atributos de cada leitura:
- Tipo: qualidade do produto em fabricação (L = baixa, M = média, H = alta)
- Temperatura do ar [K]
- Temperatura do processo [K]
- Rotação [rpm]
- Torque [Nm]
- Desgaste da ferramenta [min]: tempo acumulado de uso da ferramenta"""

DERIVED_ATTRS = """
Atributos derivados, já calculados para você:
- ΔT [K] = temperatura do processo - temperatura do ar
- Potência [W] = torque x rotação x 2π/60
- Desgaste x torque [min·Nm]"""

RULES = """
Mecanismos de falha conhecidos desta máquina (a falha ocorre se QUALQUER um valer):
1. Falha de potência: potência abaixo de 3500 W ou acima de 9000 W.
2. Falha de dissipação de calor: ΔT abaixo de 8,6 K E rotação abaixo de 1380 rpm, ao mesmo tempo.
3. Falha por sobrecarga: desgaste x torque acima de 11000 min·Nm (tipo L), 12000 (tipo M) ou 13000 (tipo H).
4. Falha por desgaste: a ferramenta é trocada ou quebra num instante aleatório entre 200 e 240 min de uso.
   Nessa faixa o risco é moderado, mas a maioria dos casos NÃO falha; abaixo de 200 min esse modo não ocorre.
5. Há ainda falhas aleatórias raríssimas (cerca de 0,1%), impossíveis de prever.
Se nenhum mecanismo se aplica, a leitura é normal. Falhas são raras: cerca de 3% dos ciclos."""

INTRO = """Você é um engenheiro de manutenção especialista em máquinas de usinagem (fresadoras).
Sua tarefa é classificar se uma máquina vai FALHAR (1) ou NÃO falhar (0) a partir de leituras de sensores de um ciclo de operação."""


@dataclass(frozen=True)
class Variant:
    name: str
    label: str
    derived: bool
    rules: bool
    knn: int         # 0 = zero-shot
    domain: bool     # regras da documentação no prompt


VARIANTS = {
    "knn10": Variant("knn10", "few-shot k=10 por vizinhos", False, False, 10, False),
    "derivados": Variant("derivados", "zero-shot + derivados", True, False, 0, False),
    "regras": Variant("regras", "zero-shot + regras + derivados", True, True, 0, True),
    "regras_knn10": Variant("regras_knn10", "k=10 vizinhos + regras + derivados", True, True, 10, True),
}


def system_prompt(v: Variant) -> str:
    if not (v.derived or v.rules):
        return SYSTEM_V1
    parts = [INTRO, "", ATTRS]
    if v.derived:
        parts.append(DERIVED_ATTRS)
    if v.rules:
        parts.append(RULES)
    parts += ["", OUTPUT_FORMAT]
    return "\n".join(parts)


def describe_row(row: pd.Series, derived: bool) -> str:
    s = (
        f"Tipo: {row['Type']} | "
        f"Temperatura do ar: {row['Air temperature [K]']:.1f} K | "
        f"Temperatura do processo: {row['Process temperature [K]']:.1f} K | "
        f"Rotação: {int(row['Rotational speed [rpm]'])} rpm | "
        f"Torque: {row['Torque [Nm]']:.1f} Nm | "
        f"Desgaste da ferramenta: {int(row['Tool wear [min]'])} min"
    )
    if derived:
        s += (
            f" | ΔT: {row['Temp diff [K]']:.1f} K"
            f" | Potência: {row['Power [W]']:.0f} W"
            f" | Desgaste x torque: {row['Strain [min*Nm]']:.0f} min·Nm"
        )
    return s


class NeighborIndex:

    def __init__(self, train: pd.DataFrame):
        self.train = train.reset_index(drop=True)
        self.scaler = StandardScaler().fit(self.train[C.NUMERIC_COLS])
        self.X = self._encode(self.train)
        self.nn = NearestNeighbors().fit(self.X)

    def _encode(self, df: pd.DataFrame) -> np.ndarray:
        num = self.scaler.transform(df[C.NUMERIC_COLS])
        typ = pd.get_dummies(df["Type"].astype(str)).reindex(columns=["L", "M", "H"], fill_value=0)
        return np.hstack([num, typ.to_numpy(dtype=float)])

    def neighbors(self, row: pd.Series, k: int) -> pd.DataFrame:
        x = self._encode(row.to_frame().T)
        _, idx = self.nn.kneighbors(x, n_neighbors=k + 1)
        found = self.train.iloc[idx[0]]
        found = found[found["UDI"] != row["UDI"]]  # na validação, o próprio caso está no treino
        # o mais parecido fica por último, logo antes do caso
        return found.head(k).iloc[::-1]


def build_messages(row: pd.Series, v: Variant, index: NeighborIndex | None) -> tuple[str, str]:
    parts = []
    if v.knn:
        ex = index.neighbors(row, v.knn)
        parts.append(f"Leituras rotuladas mais parecidas com o caso, do histórico ({len(ex)}):")
        for _, e in ex.iterrows():
            parts.append(f"- {describe_row(e, v.derived)} -> " + json.dumps({"falha": int(e[C.TARGET])}))
        parts.append("")
    parts.append("Classifique esta leitura:")
    parts.append(describe_row(row, v.derived))
    return system_prompt(v), "\n".join(parts)


def rule_baseline(df: pd.DataFrame, with_twf: bool = False) -> pd.Series:
    """As regras da documentação aplicadas direto, sem LLM."""
    lim = df["Type"].map({"L": 11000, "M": 12000, "H": 13000})
    pwf = (df["Power [W]"] < 3500) | (df["Power [W]"] > 9000)
    hdf = (df["Temp diff [K]"] < 8.6) & (df["Rotational speed [rpm]"] < 1380)
    osf = df["Strain [min*Nm]"] > lim
    r = pwf | hdf | osf
    if with_twf:
        r |= df["Tool wear [min]"].between(200, 240)
    return r.astype(int)
