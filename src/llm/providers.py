"""Clientes de LLM. O provedor é escolhido por variável de ambiente (arquivo .env).

Provedores:
    deepseek           DeepSeek (padrão; API compatível com OpenAI) DEEPSEEK_API_KEY
    zhipu              GLM / Zhipu AI, ex.: glm-4-flash            ZHIPU_API_KEY
    anthropic          Claude (SDK oficial anthropic)              ANTHROPIC_API_KEY
    openai_compatible  qualquer endpoint compatível com OpenAI     LLM_API_KEY + LLM_BASE_URL
                       (OpenRouter, Groq, Ollama local, etc.)
    dummy              regra fixa, offline, para testar o pipeline sem custo

As chaves vêm do .env (modelo em .env.example).
"""
from __future__ import annotations

import json
import math
import os
import random
import re
import time
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODELS = {
    "deepseek": "deepseek-chat",
    "zhipu": "glm-4-flash",
    "anthropic": "claude-haiku-5-5",
    "openai_compatible": "",
    "dummy": "rule-v1",
}

BASE_URLS = {
    "deepseek": "https://api.deepseek.com",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4/",
}

KEY_VARS = {
    "deepseek": "DEEPSEEK_API_KEY",
    "zhipu": "ZHIPU_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai_compatible": "LLM_API_KEY",
}


@dataclass
class LLMResponse:
    text: str
    input_tokens: int
    output_tokens: int
    latency_s: float


class LLMClient:
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.provider = (provider or os.getenv("LLM_PROVIDER", "deepseek")).strip().lower()
        if self.provider not in DEFAULT_MODELS:
            raise ValueError(f"Provedor desconhecido: {self.provider}. Opções: {list(DEFAULT_MODELS)}")
        self.model = model or os.getenv("LLM_MODEL") or DEFAULT_MODELS[self.provider]
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "5"))
        self._client = self._make_client()

    def _api_key(self) -> str:
        var = KEY_VARS[self.provider]
        key = os.getenv(var)
        if not key:
            raise RuntimeError(f"Defina {var} no arquivo .env (veja .env.example).")
        return key

    def _make_client(self):
        if self.provider == "dummy":
            return None
        if self.provider == "anthropic":
            import anthropic

            return anthropic.Anthropic(api_key=self._api_key())
        from openai import OpenAI

        base_url = os.getenv("LLM_BASE_URL") or BASE_URLS.get(self.provider)
        if not base_url:
            raise RuntimeError("Defina LLM_BASE_URL no .env para o provedor openai_compatible.")
        if not self.model:
            raise RuntimeError("Defina LLM_MODEL no .env para o provedor openai_compatible.")
        return OpenAI(api_key=self._api_key(), base_url=base_url)

    def complete(self, system: str, user: str) -> LLMResponse:
        last_err = None
        for attempt in range(self.max_retries):
            try:
                t0 = time.perf_counter()
                text, tin, tout = self._call(system, user)
                return LLMResponse(text, tin, tout, time.perf_counter() - t0)
            except Exception as e:  # rede, limite de taxa, 5xx...
                last_err = e
                wait = min(60, 2 ** attempt + random.random())
                print(f"   [retry {attempt + 1}/{self.max_retries}] {type(e).__name__}: {e} (aguardando {wait:.0f}s)")
                time.sleep(wait)
        raise RuntimeError(f"Falhou após {self.max_retries} tentativas") from last_err

    def _call(self, system: str, user: str) -> tuple[str, int, int]:
        if self.provider == "dummy":
            return _dummy_rule(user), len((system + user).split()), 12

        if self.provider == "anthropic":
            # Os modelos Claude atuais não aceitam temperature; usa-se effort.
            resp = self._client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"effort": os.getenv("ANTHROPIC_EFFORT", "low")},
            )
            if resp.stop_reason == "refusal":
                return '{"falha": 0, "probabilidade": 0.5, "erro": "refusal"}', resp.usage.input_tokens, resp.usage.output_tokens
            text = "".join(b.text for b in resp.content if b.type == "text")
            return text, resp.usage.input_tokens, resp.usage.output_tokens

        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=0,
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "200")),
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        u = resp.usage
        return resp.choices[0].message.content or "", getattr(u, "prompt_tokens", 0), getattr(u, "completion_tokens", 0)


def _dummy_rule(user: str) -> str:
    """Regras de potência, sobrecarga e desgaste da documentação da base."""
    case = user.split("Classifique esta leitura:")[-1]

    def num(pattern: str) -> float:
        return float(re.search(pattern, case).group(1))

    rpm, torque, wear = num(r"Rotação: ([\d.]+)"), num(r"Torque: ([\d.]+)"), num(r"Desgaste da ferramenta: ([\d.]+)")
    power = torque * rpm * 2 * math.pi / 60
    risk = (power < 3500 or power > 9000) or wear * torque > 11000 or wear > 200
    return json.dumps({"falha": int(risk), "probabilidade": 0.8 if risk else 0.1})


def parse_answer(text: str) -> tuple[int | None, float | None]:
    """Extrai (rótulo, probabilidade) da resposta. Tolera texto extra e cercas ```json."""
    m = re.search(r'"falha"\s*:\s*([01])', text)
    label = int(m.group(1)) if m else None
    p = re.search(r'"probabilidade"\s*:\s*([0-9]*\.?[0-9]+)', text)
    prob = float(p.group(1)) if p else None
    if prob is not None:
        prob = min(max(prob, 0.0), 1.0)
    if label is None and prob is not None:
        label = int(prob >= 0.5)
    return label, prob
