# Dados

## `raw/ai4i2020.csv`

**AI4I 2020 Predictive Maintenance Dataset** (Matzka, 2020), UCI Machine Learning Repository,
<https://archive.ics.uci.edu/dataset/601>. Licença CC BY 4.0.

Base sintética que reproduz uma fresadora industrial: 10.000 ciclos, 14 colunas.

| Coluna | Descrição | Uso |
|---|---|---|
| UDI | identificador da linha (1 a 10000) | removida |
| Product ID | número de série (letra = tipo) | removida |
| Type | qualidade do produto: L (60%), M (30%), H (10%) | atributo (one-hot) |
| Air temperature [K] | temperatura do ar | atributo |
| Process temperature [K] | temperatura do processo | atributo |
| Rotational speed [rpm] | rotação | atributo |
| Torque [Nm] | torque | atributo |
| Tool wear [min] | desgaste acumulado da ferramenta | atributo |
| **Machine failure** | 1 se houve falha (339 casos, 3,39%) | **alvo** |
| TWF, HDF, PWF, OSF, RNF | modo da falha (desgaste, calor, potência, sobrecarga, aleatória) | removidos (vazamento) |

Contagens conferidas no arquivo: L 6000 / M 2997 / H 1003; falhas 339; TWF 46, HDF 115,
PWF 95, OSF 98, RNF 19. São os números da documentação oficial.

Observação: a cópia foi obtida de um espelho no GitHub porque o site da UCI estava inacessível
no momento; o conteúdo bate com a documentação. Para baixar de novo da fonte oficial:
`python scripts/download_data.py`.

**Citação:** S. Matzka, "Explainable Artificial Intelligence for Predictive Maintenance
Applications," 2020 Third International Conference on Artificial Intelligence for Industries
(AI4I), 2020, pp. 91-94.

## `processed/` (gerado, fora do git)

Criado por `python -m src.data`:

- `train.csv`: 8.000 amostras (80%, estratificado), 271 falhas
- `test.csv`: 2.000 amostras (20%), 68 falhas
- `eval_sample.csv`: 200 casos fixos do teste (50 falhas + 150 normais), usados para comparar
  clássicos e LLM nos mesmos dados
- `llm_cache/`: respostas do LLM em cache
