from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw" / "ai4i2020.csv"
DATA_PROCESSED = ROOT / "data" / "processed"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"
RESULTS = REPORTS / "results"

SEED = 42

TARGET = "Machine failure"

# derivados do alvo (vazamento): só para análise
FAILURE_MODE_COLS = ["TWF", "HDF", "PWF", "OSF", "RNF"]

NUMERIC_COLS = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
CATEGORICAL_COLS = ["Type"]  # L / M / H (qualidade do produto)

USE_ENGINEERED_FEATURES = False

TEST_SIZE = 0.20

# amostra para comparar com o LLM: estratificada, teria só ~7 falhas em 200
EVAL_SAMPLE_SIZE = 200
EVAL_SAMPLE_FAILURE_RATIO = 0.25

FEW_SHOT_KS = [0, 3, 5, 10, 20]  # 0 = zero-shot
