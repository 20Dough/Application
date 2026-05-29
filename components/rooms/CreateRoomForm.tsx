"use client";

import { useState } from "react";

// CreateRoomForm — a small form that POSTs to /api/rooms and notifies the
// parent on success so the room list can refresh. Mirrors CreateWorkspaceForm.

export function CreateRoomForm({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, name, description }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to create room");
      }

      setName("");
      setDescription("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">Create a room</h2>
      <p className="mt-1 text-sm text-neutral-500">
        A room is a focused space where your team works through a topic.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="room-name"
            className="mb-1 block text-sm text-neutral-300"
          >
            Name
          </label>
          <input
            id="room-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product Planning"
            required
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label
            htmlFor="room-description"
            className="mb-1 block text-sm text-neutral-300"
          >
            Description <span className="text-neutral-600">(optional)</span>
          </label>
          <textarea
            id="room-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this room for?"
            rows={2}
            className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="mt-4 rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating…" : "Create room"}
      </button>
    </form>
  );
}
