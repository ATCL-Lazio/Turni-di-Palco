"""Offline tests for the ticket generator (network calls are mocked).

Run: python -m unittest tools/ticket_qr_generator/test_generate_ticket_qr.py
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import pathlib
import sys
from unittest import TestCase, main, mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import generate_ticket_qr as gen  # noqa: E402

URL = "https://example.supabase.co"
PAYLOAD = gen.TicketPayload(
    circuit="ATCL", event_name="Esempio", event_id="ATCL-001", ticket_number="1234567890", date="2026-02-11T11:54:00+01:00"
)


class FakeResponse:
    def __init__(self, status_code: int = 200, body: object | None = None):
        self.status_code = status_code
        self._body = body
        self.content = b"x" if body is not None else b""

    def json(self) -> object:
        return self._body

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise gen.requests.HTTPError(f"HTTP {self.status_code}")


class SignInTests(TestCase):
    def test_returns_access_token(self) -> None:
        with mock.patch.object(gen.requests, "post", return_value=FakeResponse(200, {"access_token": "jwt"})) as post:
            token = gen.sign_in_admin(supabase_url=URL, anon_key="anon", email="a@b.it", password="pw")
        self.assertEqual(token, "jwt")
        args, kwargs = post.call_args
        self.assertEqual(args[0], f"{URL}/auth/v1/token")
        self.assertEqual(kwargs["params"], {"grant_type": "password"})
        self.assertEqual(kwargs["headers"]["apikey"], "anon")

    def test_wrong_credentials_give_operator_message(self) -> None:
        with mock.patch.object(gen.requests, "post", return_value=FakeResponse(400, {"error": "x"})):
            with self.assertRaises(gen.TicketIssueError):
                gen.sign_in_admin(supabase_url=URL, anon_key="anon", email="a@b.it", password="bad")

    def test_missing_token_in_response_is_rejected(self) -> None:
        with mock.patch.object(gen.requests, "post", return_value=FakeResponse(200, {})):
            with self.assertRaises(gen.TicketIssueError):
                gen.sign_in_admin(supabase_url=URL, anon_key="anon", email="a@b.it", password="pw")


class IssueTicketTests(TestCase):
    def issue(self, response: FakeResponse) -> dict[str, str]:
        with mock.patch.object(gen.requests, "post", return_value=response) as post:
            result = gen.issue_ticket(supabase_url=URL, anon_key="anon", access_token="jwt", payload=PAYLOAD)
        self.last_call = post.call_args
        return result

    def test_success_returns_value_and_code_and_sends_issue_action(self) -> None:
        result = self.issue(FakeResponse(200, {"reserved": True, "hash": "a" * 64, "redeemCode": "ABCDE-FGHJK"}))
        self.assertEqual(result, {"hash": "a" * 64, "redeem_code": "ABCDE-FGHJK"})
        args, kwargs = self.last_call
        self.assertEqual(args[0], f"{URL}/functions/v1/ticket-activation")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer jwt")
        self.assertEqual(kwargs["json"]["action"], "issue_ticket")
        # The client no longer sends a hash: the server generates the random value.
        self.assertNotIn("hash", kwargs["json"])
        self.assertEqual(kwargs["json"]["payload"]["eventID"], "ATCL-001")

    def test_non_admin_account_is_explained(self) -> None:
        with self.assertRaises(gen.TicketIssueError) as ctx:
            self.issue(FakeResponse(403, {"error": "no"}))
        self.assertIn("admin", str(ctx.exception))

    def test_server_refusal_message_is_passed_through(self) -> None:
        with self.assertRaises(gen.TicketIssueError) as ctx:
            self.issue(FakeResponse(200, {"reserved": False, "error": "Ticket gia presente"}))
        self.assertIn("gia presente", str(ctx.exception))

    def test_malformed_success_is_rejected(self) -> None:
        with self.assertRaises(gen.TicketIssueError):
            self.issue(FakeResponse(200, {"reserved": True, "hash": 1}))


def run_main(argv: list[str], env: dict[str, str]) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with mock.patch.object(sys, "argv", ["generate_ticket_qr.py", *argv]), mock.patch.dict(os.environ, env, clear=True):
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = gen.main()
    return code, out.getvalue(), err.getvalue()


BASE_ARGS = ["--circuit", "ATCL", "--event-name", "Esempio", "--event-id", "ATCL-001", "--ticket-number", "1", "--date", "2026-02-11T11:54:00+01:00"]


class MainTests(TestCase):
    def test_local_mode_uses_random_unregistered_value(self) -> None:
        code1, out1, err1 = run_main([*BASE_ARGS, "--skip-supabase"], {})
        code2, out2, _ = run_main([*BASE_ARGS, "--skip-supabase"], {})
        self.assertEqual((code1, code2), (0, 0))
        first, second = json.loads(out1), json.loads(out2)
        self.assertRegex(first["hash"], r"^[0-9a-f]{64}$")
        self.assertNotEqual(first["hash"], second["hash"])  # same fields, different random value
        self.assertFalse(first["supabase_reserved"])
        self.assertEqual(first["redeem_code"], "")
        self.assertIn("NON", err1)

    def test_remote_mode_prints_server_issued_value_and_code(self) -> None:
        env = {"SUPABASE_URL": URL, "SUPABASE_ANON_KEY": "anon", "TICKET_ADMIN_EMAIL": "a@b.it", "TICKET_ADMIN_PASSWORD": "pw"}
        with mock.patch.object(gen, "sign_in_admin", return_value="jwt") as sign_in, mock.patch.object(
            gen, "issue_ticket", return_value={"hash": "b" * 64, "redeem_code": "ABCDE-FGHJK"}
        ) as issue:
            code, out, _ = run_main(BASE_ARGS, env)
        self.assertEqual(code, 0)
        body = json.loads(out)
        self.assertEqual(body["hash"], "b" * 64)
        self.assertEqual(body["redeem_code"], "ABCDE-FGHJK")
        self.assertTrue(body["supabase_reserved"])
        sign_in.assert_called_once()
        self.assertEqual(issue.call_args.kwargs["access_token"], "jwt")

    def test_remote_mode_requires_url_and_anon_key(self) -> None:
        code, _, err = run_main(BASE_ARGS, {"SUPABASE_SERVICE_ROLE_KEY": "service-key-not-used"})
        self.assertEqual(code, 1)
        self.assertIn("SUPABASE_ANON_KEY", err)

    def test_refused_ticket_exits_with_error_and_no_output(self) -> None:
        env = {"SUPABASE_URL": URL, "SUPABASE_ANON_KEY": "anon", "TICKET_ADMIN_EMAIL": "a@b.it", "TICKET_ADMIN_PASSWORD": "pw"}
        with mock.patch.object(gen, "sign_in_admin", return_value="jwt"), mock.patch.object(
            gen, "issue_ticket", side_effect=gen.TicketIssueError("Ticket gia presente")
        ):
            code, out, err = run_main(BASE_ARGS, env)
        self.assertEqual(code, 2)
        self.assertEqual(out, "")
        self.assertIn("gia presente", err)

    def test_no_secret_looking_value_is_printed_to_stderr(self) -> None:
        env = {"SUPABASE_URL": URL, "SUPABASE_ANON_KEY": "anon-key-value", "TICKET_ADMIN_EMAIL": "a@b.it", "TICKET_ADMIN_PASSWORD": "pw-value"}
        with mock.patch.object(gen, "sign_in_admin", return_value="jwt-value"), mock.patch.object(
            gen, "issue_ticket", return_value={"hash": "c" * 64, "redeem_code": "ABCDE-FGHJK"}
        ):
            _, _, err = run_main(BASE_ARGS, env)
        for secret in ("pw-value", "jwt-value", "anon-key-value"):
            self.assertNotIn(secret, err)


if __name__ == "__main__":
    main()
