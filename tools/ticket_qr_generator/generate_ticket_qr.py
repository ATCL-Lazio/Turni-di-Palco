#!/usr/bin/env python3
"""Ticket QR generator CLI for theatre box offices."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
from collections import OrderedDict
from dataclasses import dataclass

import qrcode
import requests


@dataclass
class TicketPayload:
    circuit: str
    event_name: str
    event_id: str
    ticket_number: str
    date: str


def to_payload_dict(payload: TicketPayload) -> OrderedDict[str, str]:
    return OrderedDict(
        (
            ("circuit", payload.circuit),
            ("eventName", payload.event_name),
            ("eventID", payload.event_id),
            ("ticketNumber", payload.ticket_number),
            ("date", payload.date),
        )
    )


def canonical_payload_json(payload: TicketPayload) -> str:
    # Match browser JSON.stringify output exactly for cross-platform hash parity.
    return json.dumps(to_payload_dict(payload), ensure_ascii=False, separators=(",", ":"))


def pretty_payload_json(payload: TicketPayload) -> str:
    return json.dumps(to_payload_dict(payload), ensure_ascii=False, indent=2)


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
        json={"action": "reserve_hash", "hash": payload_hash, "payload": to_payload_dict(payload)},
        timeout=timeout_s,
    )
    response.raise_for_status()
    body = response.json() if response.content else {}
    return bool(body.get("reserved"))


def generate_qr_png(qr_value: str, output_path: pathlib.Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image = qrcode.make(qr_value)
    image.save(output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate one-shot activation QR for Turni di Palco.")
    parser.add_argument("--circuit", required=True, help="Ticket circuit, e.g. TicketOne")
    parser.add_argument("--event-name", required=True)
    parser.add_argument("--event-id", required=True)
    parser.add_argument("--ticket-number", required=True)
    parser.add_argument("--date", required=True, help="ISO datetime, e.g. 2026-02-11T11:54:00+01:00")
    parser.add_argument("--output", default="./out/ticket-qr.png")
    parser.add_argument("--skip-supabase", action="store_true", help="Allow local-only generation")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = TicketPayload(
        circuit=args.circuit.strip(),
        event_name=args.event_name.strip(),
        event_id=args.event_id.strip(),
        ticket_number=args.ticket_number.strip(),
        date=args.date.strip(),
    )

    if not all([payload.circuit, payload.event_name, payload.event_id, payload.ticket_number, payload.date]):
        print("All fields are required.", file=sys.stderr)
        return 1

    canonical_json = canonical_payload_json(payload)
    payload_hash = sha256_hex(canonical_json)

    supabase_url = os.getenv("SUPABASE_URL", "")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not args.skip_supabase and (not supabase_url or not service_role_key):
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or use --skip-supabase).", file=sys.stderr)
        return 1

    reserved = True
    if not args.skip_supabase:
        reserved = reserve_hash(
            supabase_url=supabase_url,
            service_role_key=service_role_key,
            payload=payload,
            payload_hash=payload_hash,
        )

    if not reserved:
        print("Hash already exists on Supabase. Please verify ticket details.", file=sys.stderr)
        return 2

    qr_value = f"turni://ticket/{payload_hash}"
    output_path = pathlib.Path(args.output).resolve()
    generate_qr_png(qr_value, output_path)

    print(
        json.dumps(
            {
                "hash": payload_hash,
                "qr_value": qr_value,
                "json_payload": pretty_payload_json(payload),
                "canonical_json": canonical_json,
                "output": str(output_path),
                "supabase_reserved": reserved,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
