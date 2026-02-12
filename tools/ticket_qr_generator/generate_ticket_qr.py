#!/usr/bin/env python3
"""Ticket QR generator CLI for theatre box offices."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import json
import os
import pathlib
import re
import sys
import unicodedata
from collections import OrderedDict
from dataclasses import dataclass

import qrcode
import requests
from dotenv import load_dotenv

# Load local .env if present
load_dotenv()


@dataclass
class TicketPayload:
    circuit: str
    event_name: str
    event_id: str
    ticket_number: str
    date: str


@dataclass(frozen=True)
class CalendarEvent:
    event_id: str
    event_name: str
    event_date: str
    event_time: str
    event_datetime_iso: str


ITALIAN_MONTHS = {
    "gen": 1,
    "gennaio": 1,
    "feb": 2,
    "febbraio": 2,
    "mar": 3,
    "marzo": 3,
    "apr": 4,
    "aprile": 4,
    "mag": 5,
    "maggio": 5,
    "giu": 6,
    "giugno": 6,
    "lug": 7,
    "luglio": 7,
    "ago": 8,
    "agosto": 8,
    "set": 9,
    "settembre": 9,
    "ott": 10,
    "ottobre": 10,
    "nov": 11,
    "novembre": 11,
    "dic": 12,
    "dicembre": 12,
    "jan": 1,
    "january": 1,
    "february": 2,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}


def default_ticket_circuit() -> str:
    return os.getenv("TICKET_QR_CIRCUIT", "TicketOne").strip() or "TicketOne"


def _normalize_month_token(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_only.lower().strip().strip(".")


def _parse_calendar_date(value: str) -> dt.date:
    raw = value.strip()
    if not raw:
        raise ValueError("event_date vuota.")

    try:
        return dt.date.fromisoformat(raw)
    except ValueError:
        pass

    day_month_year = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", raw)
    if day_month_year:
        day, month, year = (int(part) for part in day_month_year.groups())
        return dt.date(year=year, month=month, day=day)

    text_date = re.fullmatch(r"(\d{1,2})\s+([A-Za-z.]+)\s+(\d{4})", raw)
    if text_date:
        day, month_token, year = text_date.groups()
        month = ITALIAN_MONTHS.get(_normalize_month_token(month_token))
        if not month:
            raise ValueError(f"Mese non riconosciuto: {month_token!r}.")
        return dt.date(year=int(year), month=month, day=int(day))

    raise ValueError(f"Formato data non supportato: {value!r}.")


def _parse_calendar_time(value: str) -> dt.time:
    raw = value.strip()
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", raw)
    if not match:
        raise ValueError(f"Formato ora non supportato: {value!r}.")
    hour = int(match.group(1))
    minute = int(match.group(2))
    second = int(match.group(3) or "0")
    return dt.time(hour=hour, minute=minute, second=second)


def event_datetime_iso(event_date: str, event_time: str) -> str:
    date_value = _parse_calendar_date(event_date)
    time_value = _parse_calendar_time(event_time)
    rome = dt.timezone(dt.timedelta(hours=1))
    event_dt = dt.datetime.combine(date_value, time_value, tzinfo=rome)
    return event_dt.isoformat(timespec="seconds")


def fetch_calendar_events(*, supabase_url: str, api_key: str, timeout_s: int = 15) -> list[CalendarEvent]:
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/events"
    response = requests.get(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "apikey": api_key,
            "Content-Type": "application/json",
        },
        params={
            "select": "id,name,event_date,event_time",
            "order": "event_date.asc,event_time.asc",
            "limit": "500",
        },
        timeout=timeout_s,
    )
    response.raise_for_status()
    rows = response.json()
    if not isinstance(rows, list):
        raise ValueError("Formato risposta calendario non valido.")

    events: list[CalendarEvent] = []
    for row in rows:
        event_id = str(row.get("id", "")).strip()
        event_name = html.unescape(str(row.get("name", ""))).strip()
        event_date = str(row.get("event_date", "")).strip()
        event_time = str(row.get("event_time", "")).strip()
        if not all([event_id, event_name, event_date, event_time]):
            continue
        events.append(
            CalendarEvent(
                event_id=event_id,
                event_name=event_name,
                event_date=event_date,
                event_time=event_time,
                event_datetime_iso=event_datetime_iso(event_date, event_time),
            )
        )

    if not events:
        raise ValueError("Calendario vuoto o senza eventi validi.")

    events.sort(key=lambda event: event.event_datetime_iso)
    return events


def get_calendar_api_key() -> str:
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )


def resolve_payload_from_calendar(
    *,
    supabase_url: str,
    api_key: str,
    event_id: str,
    ticket_number: str,
    circuit: str,
) -> TicketPayload:
    normalized_id = event_id.strip()
    if not normalized_id:
        raise ValueError("event_id mancante.")
    events = fetch_calendar_events(supabase_url=supabase_url, api_key=api_key)
    selected = next((event for event in events if event.event_id.lower() == normalized_id.lower()), None)
    if not selected:
        raise ValueError(f"Evento non trovato nel calendario: {event_id!r}.")
    return TicketPayload(
        circuit=circuit.strip(),
        event_name=selected.event_name,
        event_id=selected.event_id,
        ticket_number=ticket_number.strip(),
        date=selected.event_datetime_iso,
    )


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
    parser.add_argument("--circuit", default=default_ticket_circuit(), help="Ticket circuit, e.g. ATCL")
    parser.add_argument("--event-name")
    parser.add_argument("--event-id", required=True)
    parser.add_argument("--ticket-number", required=True)
    parser.add_argument("--date", help="ISO datetime, e.g. 2026-02-11T11:54:00+01:00")
    parser.add_argument(
        "--event-from-calendar",
        action="store_true",
        help="Load event name/date from Supabase events calendar using --event-id.",
    )
    parser.add_argument("--output", default="./out/ticket-qr.png")
    parser.add_argument("--skip-supabase", action="store_true", help="Allow local-only generation")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    supabase_url = os.getenv("SUPABASE_URL", "")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    calendar_api_key = get_calendar_api_key()

    try:
        if args.event_from_calendar:
            if not supabase_url or not calendar_api_key:
                print(
                    "SUPABASE_URL and a Supabase API key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) "
                    "are required with --event-from-calendar.",
                    file=sys.stderr,
                )
                return 1
            payload = resolve_payload_from_calendar(
                supabase_url=supabase_url,
                api_key=calendar_api_key,
                event_id=args.event_id,
                ticket_number=args.ticket_number,
                circuit=args.circuit,
            )
        else:
            payload = TicketPayload(
                circuit=args.circuit.strip(),
                event_name=(args.event_name or "").strip(),
                event_id=args.event_id.strip(),
                ticket_number=args.ticket_number.strip(),
                date=(args.date or "").strip(),
            )
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    if not all([payload.circuit, payload.event_name, payload.event_id, payload.ticket_number, payload.date]):
        print("All fields are required.", file=sys.stderr)
        return 1

    canonical_json = canonical_payload_json(payload)
    payload_hash = sha256_hex(canonical_json)

    if not args.skip_supabase and (not supabase_url or not service_role_key):
        print("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or use --skip-supabase).", file=sys.stderr)
        return 1

    reserved = False
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

    qr_value = payload_hash
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
