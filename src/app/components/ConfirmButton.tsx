"use client";

/** Delete button with a confirmation prompt to avoid accidental taps (especially on phones). */
export default function ConfirmButton({ label, message }: { label: string; message: string }) {
  return (
    <button className="danger" type="submit" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {label}
    </button>
  );
}
