"""Build Bolna api_tools config from tools.json.

This writes backend/bolna/tools.resolved.json, which contains the public backend URL and
X-Tool-Secret header value. The file is gitignored because it contains deployment-specific data.
"""

from __future__ import annotations

import argparse
import json
import os
from copy import deepcopy
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = ROOT.parent


def _replace_placeholders(value: Any, replacements: dict[str, str]) -> Any:
    if isinstance(value, str):
        for key, replacement in replacements.items():
            value = value.replace("{" + key + "}", replacement)
        return value
    if isinstance(value, list):
        return [_replace_placeholders(v, replacements) for v in value]
    if isinstance(value, dict):
        return {k: _replace_placeholders(v, replacements) for k, v in value.items()}
    return value


def build_api_tools(base_url: str, tool_secret: str) -> dict[str, Any]:
    tools = json.loads((ROOT / "tools.json").read_text(encoding="utf-8"))
    replacements = {
        "BASE_URL": base_url.rstrip("/"),
        "TOOL_WEBHOOK_SECRET": tool_secret,
    }

    tool_defs: list[dict[str, Any]] = []
    tools_params: dict[str, Any] = {}
    for raw_tool in tools:
        tool = deepcopy(raw_tool)
        name = tool["name"]
        value = _replace_placeholders(tool.pop("value"), replacements)
        tools_params[name] = value
        tool_defs.append(tool)

    return {"tools": tool_defs, "tools_params": tools_params}


def main() -> None:
    load_dotenv(BACKEND_ROOT / ".env", override=True)
    parser = argparse.ArgumentParser(description="Build Bolna api_tools payload from bolna/tools.json")
    parser.add_argument("--base-url", default=os.getenv("BASE_URL", ""), help="Public backend URL")
    parser.add_argument("--tool-secret", default=os.getenv("TOOL_WEBHOOK_SECRET", ""), help="X-Tool-Secret value")
    parser.add_argument("--out", default=str(ROOT / "tools.resolved.json"), help="Output JSON path")
    args = parser.parse_args()

    if not args.base_url:
        raise SystemExit("BASE_URL is required. Set it in backend/.env or pass --base-url.")
    if not args.tool_secret:
        raise SystemExit("TOOL_WEBHOOK_SECRET is required. Set it in backend/.env or pass --tool-secret.")

    api_tools = build_api_tools(args.base_url, args.tool_secret)
    out = Path(args.out)
    out.write_text(json.dumps(api_tools, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    print("Use this object as tasks[0].tools_config.api_tools in the Bolna agent PUT payload.")


if __name__ == "__main__":
    main()
