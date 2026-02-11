#!/usr/bin/env python3
"""Simple desktop UI for non-technical ticket-office operators."""

from __future__ import annotations

import os
import pathlib
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from PIL import Image, ImageTk
from dotenv import load_dotenv

# Load local .env if present
load_dotenv()

from generate_ticket_qr import (
    CalendarEvent,
    TicketPayload,
    canonical_payload_json,
    default_ticket_circuit,
    fetch_calendar_events,
    generate_qr_png,
    get_calendar_api_key,
    pretty_payload_json,
    reserve_hash,
    sha256_hex,
)


class TicketQrGeneratorUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Turni di Palco - Generatore QR Biglietteria")
        self.root.geometry("900x760")

        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        has_creds = bool(supabase_url and service_role_key)

        self.circuit_var = tk.StringVar(value=default_ticket_circuit())
        self.calendar_event_var = tk.StringVar(value="")
        self.event_name_var = tk.StringVar(value="-")
        self.event_id_var = tk.StringVar(value="-")
        self.date_var = tk.StringVar(value="-")
        self.ticket_number_var = tk.StringVar(value="")
        self.skip_supabase_var = tk.BooleanVar(value=not has_creds)
        self.output_var = tk.StringVar(value=str(pathlib.Path("./out/ticket-qr.png").resolve()))
        self.calendar_status_var = tk.StringVar(value="Calendario non caricato.")
        self.calendar_events: list[CalendarEvent] = []

        self.preview_image: ImageTk.PhotoImage | None = None

        self._build_layout()
        self.root.after(50, lambda: self._load_calendar_events(show_errors=False))

    def _build_layout(self) -> None:
        frame = ttk.Frame(self.root, padding=16)
        frame.pack(fill="both", expand=True)

        ttk.Label(
            frame,
            text="Seleziona evento da calendario, inserisci il numero biglietto e genera il QR.",
            font=("Arial", 12, "bold"),
        ).pack(anchor="w", pady=(0, 12))

        event_row = ttk.Frame(frame)
        event_row.pack(fill="x", pady=4)
        ttk.Label(event_row, text="Evento", width=16).pack(side="left")
        self.calendar_combo = ttk.Combobox(
            event_row,
            textvariable=self.calendar_event_var,
            state="readonly",
        )
        self.calendar_combo.pack(side="left", fill="x", expand=True)
        self.calendar_combo.bind("<<ComboboxSelected>>", self._on_calendar_selected)
        ttk.Button(event_row, text="Aggiorna calendario", command=self._load_calendar_events).pack(side="left", padx=8)

        ttk.Label(frame, textvariable=self.calendar_status_var).pack(anchor="w", pady=(2, 6))

        readonly_fields = [
            ("Circuito", self.circuit_var),
            ("Nome evento", self.event_name_var),
            ("ID evento", self.event_id_var),
            ("Data (ISO)", self.date_var),
        ]

        for label, var in readonly_fields:
            row = ttk.Frame(frame)
            row.pack(fill="x", pady=4)
            ttk.Label(row, text=label, width=16).pack(side="left")
            ttk.Entry(row, textvariable=var, state="readonly").pack(side="left", fill="x", expand=True)

        ticket_row = ttk.Frame(frame)
        ticket_row.pack(fill="x", pady=4)
        ttk.Label(ticket_row, text="Numero biglietto", width=16).pack(side="left")
        ttk.Entry(ticket_row, textvariable=self.ticket_number_var).pack(side="left", fill="x", expand=True)

        output_row = ttk.Frame(frame)
        output_row.pack(fill="x", pady=(8, 4))
        ttk.Label(output_row, text="File output", width=16).pack(side="left")
        ttk.Entry(output_row, textvariable=self.output_var).pack(side="left", fill="x", expand=True)
        ttk.Button(output_row, text="Sfoglia", command=self._pick_output).pack(side="left", padx=8)

        ttk.Checkbutton(
            frame,
            text="Modalità locale (non prenota hash su Supabase)",
            variable=self.skip_supabase_var,
        ).pack(anchor="w", pady=(8, 8))

        button_row = ttk.Frame(frame)
        button_row.pack(fill="x", pady=(0, 8))
        ttk.Button(button_row, text="Genera e Prenota QR", command=self._generate).pack(side="left")

        ttk.Label(frame, text="JSON generato", font=("Arial", 10, "bold")).pack(anchor="w", pady=(8, 4))
        self.json_box = tk.Text(frame, height=9, wrap="word")
        self.json_box.pack(fill="x")

        ttk.Label(frame, text="Hash SHA-256", font=("Arial", 10, "bold")).pack(anchor="w", pady=(8, 4))
        self.hash_var = tk.StringVar(value="-")
        ttk.Entry(frame, textvariable=self.hash_var, state="readonly").pack(fill="x")

        ttk.Label(frame, text="Anteprima QR", font=("Arial", 10, "bold")).pack(anchor="w", pady=(8, 4))
        self.qr_preview_label = ttk.Label(frame, text="Nessun QR generato")
        self.qr_preview_label.pack(anchor="w")

    def _pick_output(self) -> None:
        selected = filedialog.asksaveasfilename(
            title="Salva QR come...",
            defaultextension=".png",
            filetypes=[("PNG", "*.png")],
        )
        if selected:
            self.output_var.set(selected)

    def _load_calendar_events(self, show_errors: bool = True) -> None:
        try:
            supabase_url = os.getenv("SUPABASE_URL", "").strip()
            api_key = get_calendar_api_key()
            if not supabase_url or not api_key:
                raise ValueError(
                    "Imposta SUPABASE_URL e una chiave API Supabase "
                    "(SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY) per leggere il calendario."
                )

            current_event_id = self.event_id_var.get().strip()
            events = fetch_calendar_events(supabase_url=supabase_url, api_key=api_key)
            options = [
                f"{event.event_date} {event.event_time} | {event.event_id} | {event.event_name}"
                for event in events
            ]
            selected_index = next(
                (index for index, event in enumerate(events) if event.event_id == current_event_id),
                0,
            )

            self.calendar_events = events
            self.calendar_combo.configure(values=options)
            if options:
                self.calendar_combo.current(selected_index)
                self._set_selected_event(events[selected_index])
                self.calendar_status_var.set(f"Calendario caricato: {len(events)} eventi.")
            else:
                self.calendar_status_var.set("Nessun evento trovato nel calendario.")
        except Exception as error:
            self.calendar_events = []
            self.calendar_combo.configure(values=[])
            self.calendar_event_var.set("")
            self.event_name_var.set("-")
            self.event_id_var.set("-")
            self.date_var.set("-")
            self.calendar_status_var.set("Calendario non disponibile.")
            if show_errors:
                messagebox.showerror("Errore calendario", str(error))

    def _on_calendar_selected(self, _event: object | None = None) -> None:
        if not self.calendar_events:
            return
        selected_index = self.calendar_combo.current()
        if selected_index < 0 or selected_index >= len(self.calendar_events):
            return
        self._set_selected_event(self.calendar_events[selected_index])

    def _set_selected_event(self, event: CalendarEvent) -> None:
        self.event_name_var.set(event.event_name)
        self.event_id_var.set(event.event_id)
        self.date_var.set(event.event_datetime_iso)

    def _selected_calendar_event(self) -> CalendarEvent:
        if not self.calendar_events:
            raise ValueError("Calendario eventi non caricato.")
        selected_index = self.calendar_combo.current()
        if selected_index < 0 or selected_index >= len(self.calendar_events):
            raise ValueError("Seleziona un evento dal calendario.")
        return self.calendar_events[selected_index]

    def _build_payload(self) -> TicketPayload:
        selected_event = self._selected_calendar_event()
        payload = TicketPayload(
            circuit=self.circuit_var.get().strip(),
            event_name=selected_event.event_name.strip(),
            event_id=selected_event.event_id.strip(),
            ticket_number=self.ticket_number_var.get().strip(),
            date=selected_event.event_datetime_iso.strip(),
        )
        if not all([payload.circuit, payload.event_name, payload.event_id, payload.ticket_number, payload.date]):
            raise ValueError("Tutti i campi sono obbligatori.")
        return payload

    def _generate(self) -> None:
        try:
            payload = self._build_payload()
            canonical_json = canonical_payload_json(payload)
            payload_hash = sha256_hex(canonical_json)

            is_remote = not self.skip_supabase_var.get()
            if is_remote:
                supabase_url = os.getenv("SUPABASE_URL", "")
                service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
                if not supabase_url or not service_role_key:
                    raise ValueError(
                        "Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY oppure abilita la modalità locale."
                    )

                reserved = reserve_hash(
                    supabase_url=supabase_url,
                    service_role_key=service_role_key,
                    payload=payload,
                    payload_hash=payload_hash,
                )
                if not reserved:
                    raise ValueError("Hash già presente su Supabase. Verifica i dati del ticket (forse già generato).")

            qr_value = f"turni://ticket/{payload_hash}"
            output_path = pathlib.Path(self.output_var.get()).resolve()
            generate_qr_png(qr_value, output_path)

            self.json_box.delete("1.0", tk.END)
            self.json_box.insert(tk.END, pretty_payload_json(payload))
            self.hash_var.set(payload_hash)

            image = Image.open(output_path).resize((240, 240))
            self.preview_image = ImageTk.PhotoImage(image)
            self.qr_preview_label.configure(image=self.preview_image, text="")

            success_msg = f"QR salvato in:\n{output_path}"
            if is_remote:
                success_msg += "\n\nHash prenotato correttamente su Supabase."
            
            messagebox.showinfo("Completato", success_msg)
        except Exception as error:
            messagebox.showerror("Errore", str(error))



def main() -> None:
    root = tk.Tk()
    style = ttk.Style(root)
    try:
        style.theme_use("clam")
    except tk.TclError:
        pass

    TicketQrGeneratorUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
