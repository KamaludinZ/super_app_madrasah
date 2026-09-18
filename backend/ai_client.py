"""Thin multi-provider AI client used for system features (e.g. CLKB/PCL summaries).

Calls each provider's REST API directly via httpx so no extra SDK dependency is
required. The active provider is selected from settings (`ai_active_provider`)
and its own config lives under `ai_providers.<name>`.
"""
from typing import Any, Dict, Optional
import httpx

DEFAULT_MODELS = {
    'local': '',
    'gemini': 'gemini-2.0-flash',
    'anthropic': 'claude-haiku-4-5-20251001',
    'openai': 'gpt-4o-mini',
}

TIMEOUT = httpx.Timeout(30.0, connect=10.0)


class AIError(Exception):
    pass


async def _call_local(cfg: Dict[str, Any], prompt: str, system: Optional[str]) -> str:
    base_url = (cfg.get('base_url') or '').rstrip('/')
    if not base_url:
        raise AIError("Base URL AI Lokal belum diatur")
    model = cfg.get('model') or ''
    headers = {'Content-Type': 'application/json'}
    if cfg.get('api_key'):
        headers['Authorization'] = f"Bearer {cfg['api_key']}"
    messages = []
    if system:
        messages.append({'role': 'system', 'content': system})
    messages.append({'role': 'user', 'content': prompt})
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json={'model': model, 'messages': messages, 'temperature': 0.4},
        )
        r.raise_for_status()
        data = r.json()
        return data['choices'][0]['message']['content']


async def _call_openai(cfg: Dict[str, Any], prompt: str, system: Optional[str]) -> str:
    api_key = cfg.get('api_key')
    if not api_key:
        raise AIError("API key OpenAI belum diatur")
    model = cfg.get('model') or DEFAULT_MODELS['openai']
    messages = []
    if system:
        messages.append({'role': 'system', 'content': system})
    messages.append({'role': 'user', 'content': prompt})
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={'Authorization': f"Bearer {api_key}", 'Content-Type': 'application/json'},
            json={'model': model, 'messages': messages, 'temperature': 0.4},
        )
        r.raise_for_status()
        data = r.json()
        return data['choices'][0]['message']['content']


async def _call_anthropic(cfg: Dict[str, Any], prompt: str, system: Optional[str]) -> str:
    api_key = cfg.get('api_key')
    if not api_key:
        raise AIError("API key Anthropic belum diatur")
    model = cfg.get('model') or DEFAULT_MODELS['anthropic']
    payload = {
        'model': model,
        'max_tokens': 1024,
        'messages': [{'role': 'user', 'content': prompt}],
    }
    if system:
        payload['system'] = system
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
            },
            json=payload,
        )
        r.raise_for_status()
        data = r.json()
        parts = data.get('content', [])
        return ''.join(p.get('text', '') for p in parts if p.get('type') == 'text')


async def _call_gemini(cfg: Dict[str, Any], prompt: str, system: Optional[str]) -> str:
    api_key = cfg.get('api_key')
    if not api_key:
        raise AIError("API key Gemini belum diatur")
    model = cfg.get('model') or DEFAULT_MODELS['gemini']
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={'key': api_key},
            json={'contents': [{'parts': [{'text': full_prompt}]}]},
        )
        r.raise_for_status()
        data = r.json()
        candidates = data.get('candidates', [])
        if not candidates:
            raise AIError("Gemini tidak mengembalikan hasil")
        parts = candidates[0].get('content', {}).get('parts', [])
        return ''.join(p.get('text', '') for p in parts)


_PROVIDER_CALLERS = {
    'local': _call_local,
    'openai': _call_openai,
    'anthropic': _call_anthropic,
    'gemini': _call_gemini,
}


async def generate_text(settings: Dict[str, Any], prompt: str, system: Optional[str] = None,
                         provider_override: Optional[str] = None) -> str:
    """Generate text using the active (or overridden) AI provider from settings."""
    provider = provider_override or settings.get('ai_active_provider')
    if not provider:
        raise AIError("Belum ada provider AI aktif. Atur di Pengaturan > Integrasi AI.")

    providers_cfg = settings.get('ai_providers') or {}
    cfg = providers_cfg.get(provider) or {}
    if not cfg.get('enabled', provider == provider_override):
        raise AIError(f"Provider '{provider}' belum diaktifkan.")

    caller = _PROVIDER_CALLERS.get(provider)
    if not caller:
        raise AIError(f"Provider '{provider}' tidak dikenal.")

    try:
        text = await caller(cfg, prompt, system)
    except httpx.HTTPStatusError as e:
        raise AIError(f"Provider AI mengembalikan error: {e.response.status_code} {e.response.text[:300]}")
    except httpx.HTTPError as e:
        raise AIError(f"Gagal menghubungi provider AI: {e}")

    if not text or not text.strip():
        raise AIError("Provider AI mengembalikan hasil kosong")
    return text.strip()
