"""Configuração do experimento: caminhos, semente, colunas e tamanhos de amostra."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw" / "ai4i2020.csv"
DATA_PROCESSED = ROOT / "data" / "processed"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"
RESULTS = REPORTS / "results"

SEED = 42

TARGET = "Machine failure"

# Modos de falha: são derivados do alvo, então usá-los como atributo seria vazamento.
# Ficam só para análise.
FAILURE_MODE_COLS = ["TWF", "HDF", "PWF", "OSF", "RNF"]

NUMERIC_COLS = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
CATEGORICAL_COLS = ["Type"]  # L / M / H (qualidade do produto)

# Atributos derivados (ver src/data.py). Desligados no baseline.
USE_ENGINEERED_FEATURES = False

TEST_SIZE = 0.20

# Amostra de comparação com o LLM. Com 3,4% de falhas, 200 casos estratificados teriam
# só ~7 falhas, pouco para medir revocação, então a amostra é enriquecida com falhas.
EVAL_SAMPLE_SIZE = 200
EVAL_SAMPLE_FAILURE_RATIO = 0.25

FEW_SHOT_KS = [0, 3, 5, 10, 20]  # 0 = zero-shot
