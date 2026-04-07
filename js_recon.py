import re
import json
from pathlib import Path
from collections import defaultdict

URL_REGEX = re.compile(
    r"""
    (?:
        https?:\/\/[^\s"'`<>]+ |
        wss?:\/\/[^\s"'`<>]+ |
        \/[_a-zA-Z0-9\-./]+
    )
    """,
    re.VERBOSE
)

FETCH_REGEX = re.compile(r'fetch\s*\(\s*([^)]+)\)', re.DOTALL)
XHR_REGEX = re.compile(r'new\s+XMLHttpRequest\s*\(', re.DOTALL)
AXIOS_REGEX = re.compile(r'axios\.(get|post|put|delete)\s*\(\s*([^)]+)\)', re.DOTALL)

PARAM_SOURCES = [
    r'URLSearchParams',
    r'location\.search',
    r'document\.cookie',
    r'localStorage',
    r'sessionStorage',
    r'FormData',
    r'\.value'
]

AUTH_PATTERNS = [
    r'Authorization\s*:',
    r'Bearer\s+',
    r'credentials\s*:\s*[\'"]include[\'"]',
    r'withCredentials\s*=\s*true'
]

SENSITIVE_PATTERNS = {
    "Stripe": r'sk_(test|live)_[0-9a-zA-Z]+',
    "AWS": r'AKIA[0-9A-Z]{16}',
    "GenericToken": r'[A-Za-z0-9_-]{32,}'
}

DANGEROUS_SINKS = [
    r'\beval\s*\(',
    r'new\s+Function\s*\(',
    r'document\.write\s*\(',
    r'\.innerHTML\s*=',
    r'setTimeout\s*\(',
    r'setInterval\s*\(',
    r'postMessage\s*\('
]

def detect_invocation_context(code_snippet: str):
    if re.search(r'addEventListener\s*\(\s*[\'"]click', code_snippet):
        return "user_action"
    if re.search(r'useEffect|componentDidMount|DOMContentLoaded', code_snippet):
        return "page_load"
    if re.search(r'setTimeout|setInterval', code_snippet):
        return "background"
    return "unknown"

def detect_client_side_gating(code_snippet: str):
    gates = []
    for m in re.finditer(r'if\s*\(([^)]+)\)', code_snippet):
        gates.append(m.group(1).strip())
    return gates

def detect_auth_dependency(code_snippet: str):
    for p in AUTH_PATTERNS:
        if re.search(p, code_snippet):
            return True
    return False

def detect_ui_scope(code_snippet: str):
    if re.search(r'/admin|isAdmin|role\s*===\s*[\'"]admin', code_snippet):
        return "admin"
    if re.search(r'/dashboard', code_snippet):
        return "dashboard"
    return "unknown"

def extract_js_intelligence(js_code: str):
    data = {
        "endpoints": [],
        "http_requests": [],
        "parameters": set(),
        "auth_and_session": set(),
        "sensitive_data": [],
        "dangerous_sinks": [],
        "metadata": []
    }

    urls = set(m.group() for m in URL_REGEX.finditer(js_code))
    data["endpoints"] = sorted(urls)

    for m in FETCH_REGEX.finditer(js_code):
        snippet = m.group(0)
        data["http_requests"].append({
            "type": "fetch",
            "raw": snippet.strip(),
            "metadata": {
                "invocation": detect_invocation_context(snippet),
                "gated_by": detect_client_side_gating(snippet),
                "auth_dependency": detect_auth_dependency(snippet),
                "ui_scope": detect_ui_scope(snippet)
            }
        })

    for m in AXIOS_REGEX.finditer(js_code):
        snippet = m.group(0)
        data["http_requests"].append({
            "type": "axios",
            "method": m.group(1),
            "raw": snippet.strip(),
            "metadata": {
                "invocation": detect_invocation_context(snippet),
                "gated_by": detect_client_side_gating(snippet),
                "auth_dependency": detect_auth_dependency(snippet),
                "ui_scope": detect_ui_scope(snippet)
            }
        })

    if XHR_REGEX.search(js_code):
        data["http_requests"].append({
            "type": "XMLHttpRequest",
            "metadata": {"invocation": "unknown"}
        })

    for p in PARAM_SOURCES:
        if re.search(p, js_code):
            data["parameters"].add(p)

    for p in AUTH_PATTERNS:
        if re.search(p, js_code):
            data["auth_and_session"].add(p)

    for provider, pattern in SENSITIVE_PATTERNS.items():
        for m in re.finditer(pattern, js_code):
            data["sensitive_data"].append({
                "provider": provider,
                "value": m.group()
            })

    for p in DANGEROUS_SINKS:
        if re.search(p, js_code):
            data["dangerous_sinks"].append(p)

    data["parameters"] = sorted(data["parameters"])
    data["auth_and_session"] = sorted(data["auth_and_session"])

    return data

if __name__ == "__main__":
    js = Path("example.js").read_text(errors="ignore")
    result = extract_js_intelligence(js)
    # print(json.dumps(result, indent=2))
    print(json.dumps(result))

