"""Configurações centrais do projeto.

Tudo que define o experimento (semente, tamanhos de amostra, caminhos) fica aqui,
para que as Etapas I e II usem exatamente os mesmos dados.
"""
from pathlib import Path

# --- Caminhos -----------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
DATA_RAW = ROOT / "data" / "raw" / "ai4i2020.csv"
DATA_PROCESSED = ROOT / "data" / "processed"
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"
RESULTS = REPORTS / "results"

# --- Reprodutibilidade --------------------------------------------------------
SEED = 42

# --- Dados ----------------------------------------------------------------------
TARGET = "Machine failure"

# Colunas identificadoras: não carregam informação física, saem do modelo.
ID_COLS = ["UDI", "Product ID"]

# Modos de falha (TWF, HDF, PWF, OSF, RNF) são DERIVADOS do alvo: usar como
# atributo seria vazamento de informação (data leakage). Ficam só para análise.
FAILURE_MODE_COLS = ["TWF", "HDF", "PWF", "OSF", "RNF"]

NUMERIC_COLS = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]
CATEGORICAL_COLS = ["Type"]  # L / M / H (qualidade do produto)

# Atributos derivados com sentido físico (opcional, ver src/data.py).
# Começamos SEM eles (baseline) e testamos depois como melhoria.
USE_ENGINEERED_FEATURES = False

# --- Divisão dos conjuntos ----------------------------------------------------
TEST_SIZE = 0.20  # 80% treino / 20% teste, estratificado pelo alvo

# --- Amostra fixa de avaliação (comparação justa clássicos x LLM) -------------
# Com ~3,4% de falhas, 200 casos estratificados teriam só ~7 falhas: pouco para
# medir revocação. Por isso a amostra é enriquecida com falhas. Os clássicos são
# avaliados no teste completo E nessa mesma amostra.
EVAL_SAMPLE_SIZE = 200
EVAL_SAMPLE_FAILURE_RATIO = 0.25  # 50 falhas + 150 normais

# --- Etapa II (few-shot) ------------------------------------------------------
FEW_SHOT_KS = [0, 3, 5, 10, 20]  # 0 = zero-shot
