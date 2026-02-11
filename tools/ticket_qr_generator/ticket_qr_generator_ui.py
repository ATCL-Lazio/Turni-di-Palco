#!/usr/bin/env python3
"""Simple desktop UI for non-technical ticket-office operators."""

from __future__ import annotations

import os
import pathlib
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from PIL import Image, ImageTk

from generate_ticket_qr import (
    TicketPayload,
    canonical_payload_json,
    generate_qr_png,
    pretty_payload_json,
    reserve_hash,
    sha256_hex,
)


class TicketQrGeneratorUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Turni di Palco - Generatore QR Biglietteria")
        self.root.geometry("860x720")

        self.circuit_var = tk.StringVar(value="TicketOne")
        self.event_name_var = tk.StringVar(value="Esempio")
        self.event_id_var = tk.StringVar(value="1234567890")
        self.ticket_number_var = tk.StringVar(value="1234567890")
        self.date_var = tk.StringVar(value="2026-02-11T11:54:00+01:00")
        self.skip_supabase_var = tk.BooleanVar(value=True)
        self.output_var = tk.StringVar(value=str(pathlib.Path("./out/ticket-qr.png").resolve()))

        self.preview_image: ImageTk.PhotoImage | None = None

        self._build_layout()

    def _build_layout(self) -> None:
        frame = ttk.Frame(self.root, padding=16)
        frame.pack(fill="both", expand=True)

        ttk.Label(
            frame,
            text="Compila i dati del biglietto e premi 'Genera QR'.",
            font=("Arial", 12, "bold"),
        ).pack(anchor="w", pady=(0, 12))

        fields = [
            ("Circuito", self.circuit_var),
            ("Nome evento", self.event_name_var),
            ("ID evento", self.event_id_var),
            ("Numero biglietto", self.ticket_number_var),
            ("Data (ISO)", self.date_var),
        ]

        for label, var in fields:
            row = ttk.Frame(frame)
            row.pack(fill="x", pady=4)
            ttk.Label(row, text=label, width=16).pack(side="left")
            ttk.Entry(row, textvariable=var).pack(side="left", fill="x", expand=True)

        output_row = ttk.Frame(frame)
        output_row.pack(fill="x", pady=(8, 4))
        ttk.Label(output_row, text="File output", width=16).pack(side="left")
        ttk.Entry(output_row, textvariable=self.output_var).pack(side="left", fill="x", expand=True)
        ttk.Button(output_row, text="Sfoglia", command=self._pick_output).pack(side="left", padx=8)

        ttk.Checkbutton(
            frame,
            text="Modalità locale (non chiama Supabase)",
            variable=self.skip_supabase_var,
        ).pack(anchor="w", pady=(8, 8))

        button_row = ttk.Frame(frame)
        button_row.pack(fill="x", pady=(0, 8))
        ttk.Button(button_row, text="Genera QR", command=self._generate).pack(side="left")

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

    def _build_payload(self) -> TicketPayload:
        payload = TicketPayload(
            circuit=self.circuit_var.get().strip(),
            event_name=self.event_name_var.get().strip(),
            event_id=self.event_id_var.get().strip(),
            ticket_number=self.ticket_number_var.get().strip(),
            date=self.date_var.get().strip(),
        )
        if not all([payload.circuit, payload.event_name, payload.event_id, payload.ticket_number, payload.date]):
            raise ValueError("Tutti i campi sono obbligatori.")
        return payload

    def _generate(self) -> None:
        try:
            payload = self._build_payload()
            canonical_json = canonical_payload_json(payload)
            payload_hash = sha256_hex(canonical_json)

            if not self.skip_supabase_var.get():
                supabase_url = os.getenv("SUPABASE_URL", "")
                service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
                if not supabase_url or not service_role_key:
                    raise ValueError("Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o abilita modalità locale.")

                reserved = reserve_hash(
                    supabase_url=supabase_url,
                    service_role_key=service_role_key,
                    payload=payload,
                    payload_hash=payload_hash,
                )
                if not reserved:
                    raise ValueError("Hash già presente su Supabase. Verifica i dati del ticket.")

            qr_value = f"turni://ticket/{payload_hash}"
            output_path = pathlib.Path(self.output_var.get()).resolve()
            generate_qr_png(qr_value, output_path)

            self.json_box.delete("1.0", tk.END)
            self.json_box.insert(tk.END, pretty_payload_json(payload))
            self.hash_var.set(payload_hash)

            image = Image.open(output_path).resize((240, 240))
            self.preview_image = ImageTk.PhotoImage(image)
            self.qr_preview_label.configure(image=self.preview_image, text="")

            messagebox.showinfo("Completato", f"QR salvato in:\n{output_path}")
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
