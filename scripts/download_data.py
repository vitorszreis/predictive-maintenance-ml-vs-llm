"""Baixa a base AI4I 2020 do repositório UCI para data/raw/ai4i2020.csv.

A base já vem incluída no projeto; use este script só se o arquivo sumir.
Uso: python scripts/download_data.py
"""
import hashlib
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

URL = "https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip"
DEST = Path(__file__).resolve().parents[1] / "data" / "raw" / "ai4i2020.csv"


def main() -> None:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"Baixando {URL} ...")
    with urllib.request.urlopen(URL, timeout=60) as r:
        payload = r.read()
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        DEST.write_bytes(z.read(name))
    print(f"Salvo em {DEST} (sha256 {hashlib.sha256(DEST.read_bytes()).hexdigest()[:16]}...)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Falhou: {e}\nBaixe manualmente em https://archive.ics.uci.edu/dataset/601 "
              f"e salve o CSV como {DEST}", file=sys.stderr)
        sys.exit(1)
