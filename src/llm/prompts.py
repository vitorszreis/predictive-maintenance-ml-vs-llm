"""Prompts da Etapa II.

Toda mudança no texto deve subir PROMPT_VERSION. O prompt de cada execução é salvo
em reports/results/prompts/.
"""
from __future__ import annotations

import json

import pandas as pd

from src import config as C

PROMPT_VERSION = "v1"

SYSTEM_PROMPT = """Você é um engenheiro de manutenção especialista em máquinas de usinagem (fresadoras).
Sua tarefa é classificar se uma máquina vai FALHAR (1) ou NÃO falhar (0) a partir de leituras de sensores de um ciclo de operação.

Atributos de cada leitura:
- Tipo: qualidade do produto em fabricação (L = baixa, M = média, H = alta)
- Temperatura do ar [K]
- Temperatura do processo [K]
- Rotação [rpm]
- Torque [Nm]
- Desgaste da ferramenta [min]: tempo acumulado de uso da ferramenta

Responda SOMENTE com um JSON de uma linha, sem texto antes ou depois, no formato:
{"falha": 0 ou 1, "probabilidade": número entre 0 e 1 com a sua confiança de que haverá falha}"""


def describe_row(row: pd.Series) -> str:
    """Leitura em texto, com os valores originais (com unidade), não os normalizados."""
    return (
        f"Tipo: {row['Type']} | "
        f"Temperatura do ar: {row['Air temperature [K]']:.1f} K | "
        f"Temperatura do processo: {row['Process temperature [K]']:.1f} K | "
        f"Rotação: {int(row['Rotational speed [rpm]'])} rpm | "
        f"Torque: {row['Torque [Nm]']:.1f} Nm | "
        f"Desgaste da ferramenta: {int(row['Tool wear [min]'])} min"
    )


def select_few_shot(train: pd.DataFrame, k: int) -> pd.DataFrame:
    """k exemplos fixos do conjunto de treino.

    Metade são falhas (no mínimo 1): na proporção real (3%) quase nunca apareceria
    uma. Os conjuntos são aninhados (os 3 exemplos estão nos 5, que estão nos 10...).
    """
    if k == 0:
        return train.iloc[0:0]
    max_k = max(C.FEW_SHOT_KS)
    fails = train[train[C.TARGET] == 1].sample(n=max_k // 2, random_state=C.SEED)
    normal = train[train[C.TARGET] == 0].sample(n=max_k, random_state=C.SEED)
    n_fail = max(1, k // 2)
    chosen = pd.concat([fails.iloc[:n_fail], normal.iloc[: k - n_fail]])
    return chosen.sample(frac=1, random_state=C.SEED)


def build_messages(row: pd.Series, examples: pd.DataFrame) -> tuple[str, str]:
    """Retorna (system, user). Exemplos few-shot vão no turno do usuário."""
    parts = []
    if len(examples):
        parts.append(f"Exemplos rotulados ({len(examples)}):")
        for _, ex in examples.iterrows():
            parts.append(f"- {describe_row(ex)} -> " + json.dumps({"falha": int(ex[C.TARGET])}))
        parts.append("")
    parts.append("Classifique esta leitura:")
    parts.append(describe_row(row))
    return SYSTEM_PROMPT, "\n".join(parts)
