#!/usr/bin/env python3
"""Simple desktop UI for non-technical ticket-office operators."""

from __future__ import annotations

import json
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


SETTINGS_PATH = pathlib.Path(os.getenv("TICKET_QR_UI_SETTINGS_PATH", "~/.turni_ticket_qr_ui.json")).expanduser()
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
DEFAULT_CIRCUIT_OPTIONS = [
    "TicketOne",
    "Vivaticket",
    "Ciaotickets",
    "DIY ticketing",
]
CIRCUIT_OPTIONS_PATH = pathlib.Path(
    os.getenv("TICKET_QR_CIRCUITS_PATH", str(SCRIPT_DIR / "circuit_options.json"))
).expanduser()

ENV_CIRCUIT_OPTIONS = "TICKET_QR_CIRCUITS"
CUSTOM_CIRCUIT_OPTION = "Altro (manuale)"

COLOR_APP_BG = "#0f1320"
COLOR_CARD_BG = "#161d2f"
COLOR_INPUT_BG = "#1e2740"
COLOR_BORDER = "#2c3654"
COLOR_TEXT = "#f1f5ff"
COLOR_TEXT_MUTED = "#aab4d3"
COLOR_ACCENT = "#4c7dff"
COLOR_ACCENT_HOVER = "#3a69e3"
COLOR_SUCCESS = "#2ea97d"
INPUT_FONT = ("TkDefaultFont", 10)
TITLE_FONT = ("TkDefaultFont", 20, "bold")
SUBTITLE_FONT = ("TkDefaultFont", 10)
SECTION_TITLE_FONT = ("TkDefaultFont", 11, "bold")


class TicketQrGeneratorUI:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Turni di Palco - Generatore QR Biglietteria")
        self.root.geometry("1240x760")
        self.root.minsize(980, 680)

        supabase_url = os.getenv("SUPABASE_URL", "").strip()
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        has_creds = bool(supabase_url and service_role_key)
        self.circuit_options = self._load_circuit_options()

        self.circuit_var = tk.StringVar(value=self._initial_circuit())
        self.calendar_event_var = tk.StringVar(value="")
        self.event_name_var = tk.StringVar(value="-")
        self.event_id_var = tk.StringVar(value="-")
        self.date_var = tk.StringVar(value="-")
        self.ticket_number_var = tk.StringVar(value="")
        self.skip_supabase_var = tk.BooleanVar(value=not has_creds)
        self.output_var = tk.StringVar(value=str(pathlib.Path("./out/ticket-qr.png").resolve()))
        self.calendar_status_var = tk.StringVar(value="Calendario non caricato.")
        self.hash_var = tk.StringVar(value="-")
        self.calendar_events: list[CalendarEvent] = []

        self.preview_image: ImageTk.PhotoImage | None = None

        self._configure_theme()
        self._build_layout()
        self.root.after(50, lambda: self._load_calendar_events(show_errors=False))

    def _normalize_circuit_options(self, values: list[object]) -> list[str]:
        seen: set[str] = set()
        normalized: list[str] = []
        for raw_value in values:
            value = str(raw_value).strip()
            key = value.lower()
            if not value or key in seen:
                continue
            seen.add(key)
            normalized.append(value)
        return normalized

    def _load_circuit_options(self) -> list[str]:
        env_value = os.getenv(ENV_CIRCUIT_OPTIONS, "").strip()
        if env_value:
            env_options = self._normalize_circuit_options(env_value.split(","))
            if env_options:
                return env_options

        if CIRCUIT_OPTIONS_PATH.exists():
            try:
                raw = json.loads(CIRCUIT_OPTIONS_PATH.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                raw = None
            if isinstance(raw, dict):
                raw = raw.get("circuits")
            if isinstance(raw, list):
                file_options = self._normalize_circuit_options(raw)
                if file_options:
                    return file_options

        return list(DEFAULT_CIRCUIT_OPTIONS)

    def _configure_theme(self) -> None:
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        self.root.configure(bg=COLOR_APP_BG)
        self.root.option_add("*Font", "TkDefaultFont 10")
        self.root.option_add("*TCombobox*Listbox.background", COLOR_INPUT_BG)
        self.root.option_add("*TCombobox*Listbox.foreground", COLOR_TEXT)
        self.root.option_add("*TCombobox*Listbox.selectBackground", COLOR_ACCENT)
        self.root.option_add("*TCombobox*Listbox.selectForeground", "#ffffff")

        style.configure("App.TFrame", background=COLOR_APP_BG)
        style.configure("Card.TFrame", background=COLOR_CARD_BG)
        style.configure("Preview.TFrame", background=COLOR_INPUT_BG, borderwidth=1, relief="solid")

        style.configure(
            "HeaderKicker.TLabel",
            background=COLOR_APP_BG,
            foreground=COLOR_ACCENT,
            font=("TkDefaultFont", 9, "bold"),
        )
        style.configure("HeaderTitle.TLabel", background=COLOR_APP_BG, foreground=COLOR_TEXT, font=TITLE_FONT)
        style.configure("HeaderSubtitle.TLabel", background=COLOR_APP_BG, foreground=COLOR_TEXT_MUTED, font=SUBTITLE_FONT)
        style.configure("CardTitle.TLabel", background=COLOR_CARD_BG, foreground=COLOR_TEXT, font=SECTION_TITLE_FONT)
        style.configure("CardHint.TLabel", background=COLOR_CARD_BG, foreground=COLOR_TEXT_MUTED, font=SUBTITLE_FONT)
        style.configure("FieldLabel.TLabel", background=COLOR_CARD_BG, foreground=COLOR_TEXT_MUTED, font=INPUT_FONT)
        style.configure("Status.TLabel", background=COLOR_CARD_BG, foreground=COLOR_SUCCESS, font=("TkDefaultFont", 9))
        style.configure("Preview.TLabel", background=COLOR_INPUT_BG, foreground=COLOR_TEXT_MUTED, font=SUBTITLE_FONT)

        style.configure(
            "Primary.TButton",
            background=COLOR_ACCENT,
            foreground="#ffffff",
            borderwidth=0,
            relief="flat",
            padding=(16, 9),
            font=("TkDefaultFont", 10, "bold"),
        )
        style.map(
            "Primary.TButton",
            background=[("active", COLOR_ACCENT_HOVER), ("pressed", COLOR_ACCENT_HOVER), ("disabled", "#5f6780")],
            foreground=[("disabled", "#dde4ff")],
        )
        style.configure(
            "Secondary.TButton",
            background=COLOR_INPUT_BG,
            foreground=COLOR_TEXT,
            bordercolor=COLOR_BORDER,
            lightcolor=COLOR_BORDER,
            darkcolor=COLOR_BORDER,
            padding=(12, 8),
            font=("TkDefaultFont", 9),
        )
        style.map(
            "Secondary.TButton",
            background=[("active", "#273252"), ("pressed", "#273252")],
            foreground=[("active", COLOR_TEXT), ("pressed", COLOR_TEXT)],
        )
        style.configure("Card.TCheckbutton", background=COLOR_CARD_BG, foreground=COLOR_TEXT, font=("TkDefaultFont", 9))
        style.map(
            "Card.TCheckbutton",
            background=[("active", COLOR_CARD_BG), ("focus", COLOR_CARD_BG)],
            foreground=[("active", COLOR_TEXT), ("focus", COLOR_TEXT)],
        )

        style.configure(
            "Value.TEntry",
            fieldbackground=COLOR_INPUT_BG,
            foreground=COLOR_TEXT,
            bordercolor=COLOR_BORDER,
            lightcolor=COLOR_BORDER,
            darkcolor=COLOR_BORDER,
            padding=6,
        )
        style.map(
            "Value.TEntry",
            fieldbackground=[("readonly", COLOR_INPUT_BG)],
            foreground=[("readonly", COLOR_TEXT)],
        )
        style.configure(
            "Value.TCombobox",
            fieldbackground=COLOR_INPUT_BG,
            background=COLOR_INPUT_BG,
            foreground=COLOR_TEXT,
            bordercolor=COLOR_BORDER,
            lightcolor=COLOR_BORDER,
            darkcolor=COLOR_BORDER,
            arrowsize=14,
            padding=5,
        )
        style.map(
            "Value.TCombobox",
            fieldbackground=[("readonly", COLOR_INPUT_BG)],
            foreground=[("readonly", COLOR_TEXT)],
            selectbackground=[("readonly", COLOR_INPUT_BG)],
            selectforeground=[("readonly", COLOR_TEXT)],
        )

    def _build_card(self, parent: ttk.Frame, title: str, hint: str | None = None, *, expand: bool = False) -> ttk.Frame:
        card = ttk.Frame(parent, style="Card.TFrame", padding=16)
        card.pack(fill="both" if expand else "x", expand=expand, pady=(0, 12))
        ttk.Label(card, text=title, style="CardTitle.TLabel").pack(anchor="w")
        if hint:
            ttk.Label(card, text=hint, style="CardHint.TLabel").pack(anchor="w", pady=(2, 10))
        content = ttk.Frame(card, style="Card.TFrame")
        content.pack(fill="both", expand=True)
        return content

    def _build_field_row(self, parent: ttk.Frame, label: str) -> tuple[ttk.Frame, ttk.Frame]:
        row = ttk.Frame(parent, style="Card.TFrame")
        row.pack(fill="x", pady=4)
        ttk.Label(row, text=label, width=16, style="FieldLabel.TLabel").pack(side="left")
        field_container = ttk.Frame(row, style="Card.TFrame")
        field_container.pack(side="left", fill="x", expand=True)
        return row, field_container

    def _initial_circuit(self) -> str:
        configured = self._load_saved_circuit()
        if configured:
            return configured
        return default_ticket_circuit()

    def _load_saved_circuit(self) -> str:
        if not SETTINGS_PATH.exists():
            return ""
        try:
            payload = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return ""
        value = str(payload.get("default_circuit", "")).strip()
        return value

    def _save_circuit_setting(self, circuit: str) -> None:
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(
            json.dumps({"default_circuit": circuit}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _build_layout(self) -> None:
        frame = ttk.Frame(self.root, padding=18, style="App.TFrame")
        frame.pack(fill="both", expand=True)

        header = ttk.Frame(frame, style="App.TFrame")
        header.pack(fill="x", pady=(0, 14))
        ttk.Label(header, text="TURNI DI PALCO", style="HeaderKicker.TLabel").pack(anchor="w")
        ttk.Label(header, text="Generatore QR Biglietteria", style="HeaderTitle.TLabel").pack(anchor="w", pady=(2, 0))
        ttk.Label(
            header,
            text="Seleziona evento, inserisci il numero biglietto e genera il QR pronto per la scansione.",
            style="HeaderSubtitle.TLabel",
        ).pack(anchor="w", pady=(4, 0))

        columns_container = ttk.Frame(frame, style="App.TFrame")
        columns_container.pack(fill="both", expand=True)
        columns_container.columnconfigure(0, weight=1, uniform="layout")
        columns_container.columnconfigure(1, weight=1, uniform="layout")
        columns_container.rowconfigure(0, weight=1)

        left_column = ttk.Frame(columns_container, style="App.TFrame")
        left_column.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        right_column = ttk.Frame(columns_container, style="App.TFrame")
        right_column.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        setup_card = self._build_card(
            left_column,
            "Dati ticket",
            "Il circuito e predefinito. Evento e dati principali arrivano dal calendario.",
            expand=True,
        )

        event_row, event_field = self._build_field_row(setup_card, "Evento")
        self.calendar_combo = ttk.Combobox(
            event_field,
            textvariable=self.calendar_event_var,
            state="readonly",
            style="Value.TCombobox",
        )
        self.calendar_combo.pack(fill="x", expand=True, side="left")
        self.calendar_combo.bind("<<ComboboxSelected>>", self._on_calendar_selected)
        ttk.Button(
            event_row,
            text="Aggiorna calendario",
            command=self._load_calendar_events,
            style="Secondary.TButton",
        ).pack(side="left", padx=(8, 0))

        ttk.Label(setup_card, textvariable=self.calendar_status_var, style="Status.TLabel").pack(anchor="w", pady=(2, 8))

        circuit_row, circuit_field = self._build_field_row(setup_card, "Circuito")
        ttk.Entry(circuit_field, textvariable=self.circuit_var, state="readonly", style="Value.TEntry").pack(
            fill="x", expand=True, side="left"
        )
        ttk.Button(
            circuit_row,
            text="Impostazioni circuito",
            command=self._open_circuit_settings,
            style="Secondary.TButton",
        ).pack(side="left", padx=(8, 0))

        readonly_fields = [
            ("Nome evento", self.event_name_var),
            ("ID evento", self.event_id_var),
            ("Data (ISO)", self.date_var),
        ]
        for label, var in readonly_fields:
            _, row_field = self._build_field_row(setup_card, label)
            ttk.Entry(row_field, textvariable=var, state="readonly", style="Value.TEntry").pack(fill="x", expand=True)

        _, ticket_field = self._build_field_row(setup_card, "Numero biglietto")
        ttk.Entry(ticket_field, textvariable=self.ticket_number_var, style="Value.TEntry").pack(fill="x", expand=True)

        output_row, output_field = self._build_field_row(setup_card, "File output")
        ttk.Entry(output_field, textvariable=self.output_var, style="Value.TEntry").pack(fill="x", expand=True, side="left")
        ttk.Button(output_row, text="Sfoglia", command=self._pick_output, style="Secondary.TButton").pack(side="left", padx=(8, 0))

        ttk.Checkbutton(
            setup_card,
            text="Modalita locale (non prenota hash su Supabase)",
            variable=self.skip_supabase_var,
            style="Card.TCheckbutton",
        ).pack(anchor="w", pady=(8, 8))

        button_row = ttk.Frame(setup_card, style="Card.TFrame")
        button_row.pack(fill="x", pady=(0, 2))
        ttk.Button(button_row, text="Genera e Prenota QR", command=self._generate, style="Primary.TButton").pack(anchor="w")

        result_card = self._build_card(
            right_column,
            "Output QR",
            "Controlla JSON, hash e anteprima prima di distribuire il biglietto.",
            expand=True,
        )
        ttk.Label(result_card, text="JSON generato", style="FieldLabel.TLabel").pack(anchor="w", pady=(0, 4))
        self.json_box = tk.Text(
            result_card,
            height=9,
            wrap="word",
            bd=0,
            relief="flat",
            bg=COLOR_INPUT_BG,
            fg=COLOR_TEXT,
            insertbackground=COLOR_TEXT,
            selectbackground=COLOR_ACCENT,
            padx=10,
            pady=8,
        )
        self.json_box.pack(fill="x")
        self.json_box.configure(highlightthickness=1, highlightbackground=COLOR_BORDER, highlightcolor=COLOR_ACCENT)

        ttk.Label(result_card, text="Hash SHA-256", style="FieldLabel.TLabel").pack(anchor="w", pady=(8, 4))
        ttk.Entry(result_card, textvariable=self.hash_var, state="readonly", style="Value.TEntry").pack(fill="x")

        ttk.Label(result_card, text="Anteprima QR", style="FieldLabel.TLabel").pack(anchor="w", pady=(8, 4))
        preview_container = ttk.Frame(result_card, style="Preview.TFrame", padding=8)
        preview_container.pack(fill="x", pady=4)
        self.qr_preview_label = ttk.Label(
            preview_container,
            text="Nessun QR generato",
            style="Preview.TLabel",
            anchor="center",
            padding=2,
        )
        self.qr_preview_label.pack(fill="both", expand=True)

    def _pick_output(self) -> None:
        selected = filedialog.asksaveasfilename(
            title="Salva QR come...",
            defaultextension=".png",
            filetypes=[("PNG", "*.png")],
        )
        if selected:
            self.output_var.set(selected)

    def _open_circuit_settings(self) -> None:
        dialog = tk.Toplevel(self.root)
        dialog.title("Impostazioni circuito")
        dialog.transient(self.root)
        dialog.grab_set()
        dialog.resizable(False, False)
        dialog.configure(bg=COLOR_APP_BG)

        content = ttk.Frame(dialog, padding=12, style="Card.TFrame")
        content.pack(fill="both", expand=True)

        ttk.Label(
            content,
            text="Seleziona il circuito di emissione da usare come default.",
            style="CardHint.TLabel",
        ).pack(anchor="w", pady=(0, 8))

        selected_option_var = tk.StringVar(value="")
        custom_value_var = tk.StringVar(value="")

        options = [*self.circuit_options, CUSTOM_CIRCUIT_OPTION]
        current_value = self.circuit_var.get().strip()
        if current_value in self.circuit_options:
            selected_option_var.set(current_value)
        else:
            selected_option_var.set(CUSTOM_CIRCUIT_OPTION)
            custom_value_var.set(current_value)

        option_row = ttk.Frame(content, style="Card.TFrame")
        option_row.pack(fill="x", pady=4)
        ttk.Label(option_row, text="Circuito", width=16, style="FieldLabel.TLabel").pack(side="left")
        option_combo = ttk.Combobox(
            option_row,
            textvariable=selected_option_var,
            values=options,
            state="readonly",
            style="Value.TCombobox",
        )
        option_combo.pack(side="left", fill="x", expand=True)

        custom_row = ttk.Frame(content, style="Card.TFrame")
        custom_row.pack(fill="x", pady=4)
        ttk.Label(custom_row, text="Valore custom", width=16, style="FieldLabel.TLabel").pack(side="left")
        custom_entry = ttk.Entry(custom_row, textvariable=custom_value_var, style="Value.TEntry")
        custom_entry.pack(side="left", fill="x", expand=True)

        def refresh_custom_state() -> None:
            is_custom = selected_option_var.get() == CUSTOM_CIRCUIT_OPTION
            custom_entry.configure(state="normal" if is_custom else "disabled")

        def save_and_close() -> None:
            selected_option = selected_option_var.get().strip()
            selected_circuit = custom_value_var.get().strip() if selected_option == CUSTOM_CIRCUIT_OPTION else selected_option
            if not selected_circuit:
                messagebox.showerror("Errore", "Inserisci un circuito valido.", parent=dialog)
                return
            self.circuit_var.set(selected_circuit)
            try:
                self._save_circuit_setting(selected_circuit)
            except OSError as error:
                messagebox.showerror("Errore", f"Impossibile salvare le impostazioni:\n{error}", parent=dialog)
                return
            dialog.destroy()
            messagebox.showinfo("Impostazioni salvate", "Circuito predefinito aggiornato.")

        refresh_custom_state()
        option_combo.bind("<<ComboboxSelected>>", lambda _event: refresh_custom_state())

        button_row = ttk.Frame(content, style="Card.TFrame")
        button_row.pack(fill="x", pady=(10, 0))
        ttk.Button(button_row, text="Annulla", command=dialog.destroy, style="Secondary.TButton").pack(side="right")
        ttk.Button(button_row, text="Salva", command=save_and_close, style="Primary.TButton").pack(side="right", padx=(0, 8))

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
                        "Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY oppure abilita la modalita locale."
                    )

                reserved = reserve_hash(
                    supabase_url=supabase_url,
                    service_role_key=service_role_key,
                    payload=payload,
                    payload_hash=payload_hash,
                )
                if not reserved:
                    raise ValueError("Hash gia presente su Supabase. Verifica i dati del ticket (forse gia generato).")

            qr_value = f"turni://ticket/{payload_hash}"
            output_path = pathlib.Path(self.output_var.get()).resolve()
            generate_qr_png(qr_value, output_path)

            self.json_box.delete("1.0", tk.END)
            self.json_box.insert(tk.END, pretty_payload_json(payload))
            self.hash_var.set(payload_hash)

            # Resize QR code to fit container while maintaining aspect ratio
            image = Image.open(output_path)
            # Calculate appropriate size based on container width
            max_size = 250  # Larger size for two-column layout
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
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
    TicketQrGeneratorUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
