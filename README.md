# Manutenção preditiva: modelos clássicos x LLM

> Previsão de falhas em máquinas industriais com SVM, MLP, Random Forest e XGBoost,
> comparados a um LLM classificando por *prompting* (zero-shot e few-shot), nos mesmos dados.

**Predictive maintenance: classical ML vs. LLM prompting.** Binary failure prediction on the
AI4I 2020 dataset, comparing tuned classical models with an LLM used as a zero/few-shot classifier
on the same fixed test sample, including time and cost per 100 predictions.

Trabalho final da disciplina **DCC068 Redes Neurais Artificiais**, Sistemas de Informação, UFJF (2026/2).

<!-- Quando tiver resultados, coloque aqui a figura principal: -->
<!-- ![Comparação F1](reports/figures/comparison_f1.png) -->

## Problema

Em uma linha de produção, uma parada não planejada custa caro. A pergunta é: **dadas as leituras
de sensores de um ciclo de operação, a máquina vai falhar?** É uma classificação binária muito
desbalanceada (3,4% de falhas), em que errar uma falha (falso negativo) custa mais que um alarme falso.

- **Base:** [AI4I 2020 Predictive Maintenance](https://archive.ics.uci.edu/dataset/601) (UCI), 10.000 ciclos
- **Atributos:** tipo do produto, temperaturas do ar e do processo, rotação, torque, desgaste da ferramenta
- **Alvo:** `Machine failure` (339 falhas)

## Abordagem

| Etapa | O quê | Como |
|---|---|---|
| Dados | limpeza, normalização, balanceamento, divisão | split estratificado 80/20; z-score e SMOTE ajustados só no treino; remoção das colunas que vazam o alvo |
| I. Clássicos | SVM, MLP (+ Random Forest e XGBoost de referência) | busca em grade com validação cruzada estratificada (5 folds), otimizando F1 |
| II. LLM | classificação via prompt | zero-shot e few-shot com 3, 5, 10 e 20 exemplos; DeepSeek (`deepseek-chat`) via API, com provedor configurável (GLM, Claude, ...) |
| Comparação | mesmas métricas, mesmos dados | amostra fixa de 200 casos do teste (50 falhas); acurácia, precisão, revocação, F1, AUC-ROC, matriz de confusão, tempo e custo por 100 amostras |

## Resultados

*Em andamento.* A tabela final é gerada por `python -m src.compare` em
[`reports/results/comparison.md`](reports/results/comparison.md).

| Modelo | Configuração | Precisão | Revocação | F1 | AUC-ROC | Tempo/100 | Custo/100 |
|---|---|---|---|---|---|---|---|
| SVM | | | | | | | |
| MLP | | | | | | | |
| LLM | zero-shot | | | | | | |
| LLM | few-shot (melhor k) | | | | | | |

## Como rodar

O ambiente é gerenciado com [uv](https://docs.astral.sh/uv/). Instale o uv uma vez
(Windows: `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`), depois:

```bash
uv sync                               # cria .venv com Python 3.12 e instala tudo (versões travadas no uv.lock)

uv run python -m src.data              # 1. prepara os conjuntos (treino, teste, amostra fixa)
uv run python -m src.train_classical   # 2. Etapa I: SVM, MLP, RF, XGBoost
copy .env.example .env                 # 3. Etapa II: coloque a DEEPSEEK_API_KEY no .env (Linux/Mac: cp)
uv run python -m src.run_llm --dry-run #    confere o prompt sem chamar a API
uv run python -m src.run_llm --limit 10 #   teste barato com 10 casos
uv run python -m src.run_llm           #    zero-shot + few-shot 3/5/10/20 na amostra toda
uv run python -m src.compare           # 4. tabela e gráfico finais

uv run jupyter lab                     # notebooks
```

No VS Code, selecione o interpretador `.venv` da pasta. Para adicionar uma biblioteca: `uv add nome`.
Com `LLM_PROVIDER=dummy` o passo 3 roda offline e sem custo, útil para testar o pipeline.
Sem uv: `pip install -r requirements.txt`.

## Estrutura

```
├── data/
│   ├── raw/ai4i2020.csv        base original (versionada)
│   └── processed/              conjuntos gerados e cache do LLM (fora do git)
├── notebooks/
│   ├── 01_eda_preparacao.ipynb
│   ├── 02_etapa1_classicos.ipynb
│   ├── 03_etapa2_llm.ipynb
│   └── 04_comparacao.ipynb
├── src/
│   ├── config.py               semente, caminhos, tamanhos de amostra
│   ├── data.py                 carga, limpeza, split, amostra fixa
│   ├── metrics.py              métricas e gráficos comuns
│   ├── train_classical.py      Etapa I
│   ├── run_llm.py              Etapa II
│   ├── compare.py              comparação final
│   └── llm/
│       ├── prompts.py          prompt versionado e seleção dos exemplos few-shot
│       └── providers.py        clientes DeepSeek / GLM / Claude / OpenAI-compatível
├── reports/
│   ├── relatorio.md            relatório técnico
│   ├── figures/                matrizes de confusão, ROC, comparação
│   ├── results/                métricas (summary.csv), predições e prompts usados
│   └── slides/
├── scripts/download_data.py
├── pyproject.toml              dependências (uv)
└── uv.lock                     versões travadas
```

## Decisões de projeto

- **Sem vazamento:** as colunas TWF, HDF, PWF, OSF e RNF indicam o *tipo* de falha e só existem
  quando há falha, então foram removidas dos atributos. Normalização e SMOTE rodam dentro do
  pipeline, ajustados só nos folds de treino.
- **Métrica principal F1 / revocação**, não acurácia: um modelo que diz "nunca falha" já tem 96,6% de acurácia.
- **Amostra fixa enriquecida:** chamar um LLM 10.000 vezes por configuração é caro e lento, então a
  comparação usa 200 casos fixos do teste, com 25% de falhas para que a revocação seja mensurável.
  Os clássicos são avaliados nessa amostra e também no teste completo.
- **Reprodutibilidade:** semente fixa (42), prompt versionado, versão do modelo e preços registrados
  a cada execução, respostas do LLM em cache.

## Referências

- S. Matzka. *Explainable Artificial Intelligence for Predictive Maintenance Applications.* AI4I 2020.
- T. Brown et al. *Language Models are Few-Shot Learners.* NeurIPS 2020.
- S. Hegselmann et al. *TabLLM: Few-shot Classification of Tabular Data with Large Language Models.* AISTATS 2023.

## Autor

Vitor Reis
