#!/usr/bin/env python3
"""Prototype CLI for theatre box offices.

Flow:
1) collect ticket metadata
2) build canonical JSON payload
3) hash payload (SHA-256)
4) reserve hash on Supabase Edge Function
5) generate PNG QR with value `turni://ticket/<hash>`
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

import qrcode
import requests


@dataclass
class TicketPayload:
    source: str
    ticket_code: str
    theatre_id: str
    performance_iso: str
    issued_at_iso: str
    salt: int


def canonical_payload_json(payload: TicketPayload) -> str:
    return json.dumps(asdict(payload), separators=(",", ":"), sort_keys=True)


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def reserve_hash(
    *,
    supabase_url: str,
    service_role_key: str,
    payload: TicketPayload,
    payload_hash: str,
    timeout_s: int = 15,
) -> bool:
    endpoint = f"{supabase_url.rstrip('/')}/functions/v1/ticket-activation"
    response = requests.post(
        endpoint,
        headers={
            "Authorization": f"Bearer {service_role_key}",
            "apikey": service_role_key,
            "Content-Type": "application/json",
        },
        json={"action": "reserve_hash", "hash": payload_hash, "payload": asdict(payload)},
        timeout=timeout_s,
    )
    response.raise_for_status()
    body = response.json() if response.content else {}
    return bool(body.get("reserved"))


def build_ticket_payload(args: argparse.Namespace, salt: int) -> TicketPayload:
    now_iso = datetime.now(timezone.utc).isoformat()
    return TicketPayload(
        source=args.source,
        ticket_code=args.ticket_code.strip().upper(),
        theatre_id=args.theatre_id.strip(),
        performance_iso=args.performance_iso.strip(),
        issued_at_iso=now_iso,
        salt=salt,
    )


def generate_qr_png(qr_value: str, output_path: pathlib.Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image = qrcode.make(qr_value)
    image.save(output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate one-shot activation QR for Turni di Palco.")
    parser.add_argument("--ticket-code", required=True)
    parser.add_argument("--theatre-id", required=True)
    parser.add_argument("--performance-iso", required=True)
    parser.add_argument("--source", default="ticket-office")
    parser.add_argument("--max-attempts", type=int, default=8)
    parser.add_argument("--output", default="./out/ticket-qr.png")
    parser.add_argument("--skip-supabase", action="store_true", help="Allow local-only generation")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    supabase_url = os.getenv("SUPABASE_URL", "")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not args.skip_supabase and (not supabase_url or not service_role_key):
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or use --skip-supabase).", file=sys.stderr)
        return 1

    for salt in range(args.max_attempts):
        payload = build_ticket_payload(args, salt)
        json_payload = canonical_payload_json(payload)
        payload_hash = sha256_hex(json_payload)

        reserved = True
        if not args.skip_supabase:
            reserved = reserve_hash(
                supabase_url=supabase_url,
                service_role_key=service_role_key,
                payload=payload,
                payload_hash=payload_hash,
            )

        if not reserved:
            continue

        qr_value = f"turni://ticket/{payload_hash}"
        output_path = pathlib.Path(args.output).resolve()
        generate_qr_png(qr_value, output_path)

        print(json.dumps(
            {
                "hash": payload_hash,
                "qr_value": qr_value,
                "json_payload": json_payload,
                "output": str(output_path),
                "supabase_reserved": reserved,
            },
            indent=2,
        ))
        return 0

    print("Unable to reserve a unique hash after max attempts.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
