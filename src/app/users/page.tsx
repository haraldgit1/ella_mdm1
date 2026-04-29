"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  createdAt: string;
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "user" };
const EMPTY_PW = { newPassword: "", confirm: "" };

export default function UsersPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "user" });
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  // Password dialog
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState(EMPTY_PW);
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/users");
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Fehler beim Laden");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isPending && session) loadUsers();
  }, [isPending, session, loadUsers]);

  if (isPending) return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Laden…</p></div>;
  if (!session) { router.replace("/login"); return null; }

  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">Kein Zugriff — nur für Administratoren.</p>
      </div>
    );
  }

  const filtered = users.filter((u) => {
    const q = filter.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error ?? "Fehler"); return; }
    setShowCreate(false);
    setCreateForm(EMPTY_FORM);
    loadUsers();
  }

  // ── Edit open ───────────────────────────────────────────────────────────────
  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role ?? "user" });
    setEditError("");
    setConfirmDelete(false);
    setShowPw(false);
    setPwForm(EMPTY_PW);
    setPwError("");
  }

  // ── Save edit ───────────────────────────────────────────────────────────────
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditError("");
    setSaving(true);
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name, email: editForm.email, role: editForm.role }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setEditError(data.error ?? "Fehler beim Speichern"); return; }
    setEditUser(null);
    loadUsers();
  }

  // ── Ban / Unban ─────────────────────────────────────────────────────────────
  async function handleBanToggle() {
    if (!editUser) return;
    setEditError("");
    setSaving(true);
    const action = editUser.banned ? "unban" : "ban";
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setEditError(data.error ?? "Fehler"); return; }
    setEditUser(null);
    loadUsers();
  }

  // ── Set Password ────────────────────────────────────────────────────────────
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setPwError("");
    if (pwForm.newPassword !== pwForm.confirm) { setPwError("Passwörter stimmen nicht überein"); return; }
    setPwSaving(true);
    const res = await fetch(`/api/users/${editUser.id}/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: pwForm.newPassword }),
    });
    const data = await res.json();
    setPwSaving(false);
    if (!res.ok) { setPwError(data.error ?? "Fehler"); return; }
    setShowPw(false);
    setPwForm(EMPTY_PW);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!editUser) return;
    setSaving(true);
    const res = await fetch(`/api/users/${editUser.id}`, { method: "DELETE" });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setEditError(data.error ?? "Fehler beim Löschen"); setConfirmDelete(false); return; }
    setEditUser(null);
    loadUsers();
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-lg font-semibold text-gray-900">Benutzer-Verwaltung</h1>
        </div>
        <span className="text-sm text-gray-500">{session.user.email}</span>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-6 max-w-4xl mx-auto w-full">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Suchen nach Name oder E-Mail…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => { setShowCreate(true); setCreateForm(EMPTY_FORM); setCreateError(""); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Neuer Benutzer
          </button>
        </div>

        {/* Error */}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-400 text-center">Wird geladen…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">Keine Benutzer gefunden.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">E-Mail</th>
                  <th className="px-4 py-3 text-left">Rolle</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Erstellt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => openEdit(u)}
                    className={`cursor-pointer transition hover:bg-blue-50 ${u.id === session.user.id ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.name}
                      {u.id === session.user.id && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Du</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {u.role === "admin" ? "Admin" : "Benutzer"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        u.banned ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                      }`}>
                        {u.banned ? "Gesperrt" : "Aktiv"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString("de-DE")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-gray-400">{filtered.length} Benutzer</p>
      </main>

      {/* ── Create Dialog ─────────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Neuer Benutzer</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Name *</label>
                <input
                  type="text" required value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">E-Mail *</label>
                <input
                  type="email" required value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Passwort * (mind. 8 Zeichen)</label>
                <input
                  type="password" required minLength={8} value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Rolle</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="user">Benutzer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {createError && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{createError}</p>}

              <div className="mt-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Abbrechen
                </button>
                <button type="submit" disabled={creating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {creating ? "Wird angelegt…" : "Benutzer anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Dialog ───────────────────────────────────────────────────────── */}
      {editUser && !showPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Benutzer bearbeiten</h2>
              {editUser.id === session.user.id && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Ihr Konto</span>
              )}
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Name *</label>
                <input
                  type="text" required value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">E-Mail *</label>
                <input
                  type="email" required value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Rolle</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="user">Benutzer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {editError && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{editError}</p>}

              {/* Action buttons */}
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPw(true); setPwForm(EMPTY_PW); setPwError(""); }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Passwort setzen
                </button>
                {editUser.id !== session.user.id && (
                  <button
                    type="button"
                    onClick={handleBanToggle}
                    disabled={saving}
                    className={`rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50 ${
                      editUser.banned
                        ? "border-green-300 text-green-700 hover:bg-green-50"
                        : "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                    }`}
                  >
                    {editUser.banned ? "Entsperren" : "Sperren"}
                  </button>
                )}
                {editUser.id !== session.user.id && !confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    Löschen
                  </button>
                )}
                {confirmDelete && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Wirklich löschen?</span>
                    <button type="button" onClick={handleDelete} disabled={saving}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50">
                      Ja, löschen
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                      Nein
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 flex gap-2 justify-end border-t border-gray-100 pt-3">
                <button type="button" onClick={() => setEditUser(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Abbrechen
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Wird gespeichert…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Password Dialog ───────────────────────────────────────────────────── */}
      {editUser && showPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Passwort setzen — {editUser.name}
            </h2>
            <form onSubmit={handleSetPassword} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Neues Passwort *</label>
                <input
                  type="password" required minLength={8} value={pwForm.newPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Passwort bestätigen *</label>
                <input
                  type="password" required minLength={8} value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {pwError && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-600">{pwError}</p>}

              <div className="mt-2 flex gap-2 justify-end">
                <button type="button" onClick={() => setShowPw(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Zurück
                </button>
                <button type="submit" disabled={pwSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {pwSaving ? "Wird gesetzt…" : "Passwort setzen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
