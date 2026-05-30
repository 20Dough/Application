"use client";

import { useState } from "react";

// GenerateDecisionForm — pick a room (and optionally an agent) and generate a
// decision summary from that room's recent messages. The agent is optional; when
// left as "Default", the server uses the room's default agent (or the first
// active workspace agent).

export type RoomOption = { id: string; name: string };
export type AgentOption = { id: string; displayName: string };

export type GenerateDecisionValues = {
  roomId: string;
  agentId: string;
};

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-sm text-neutral-300";

export function GenerateDecisionForm({
  rooms,
  agents,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  rooms: RoomOption[];
  agents: AgentOption[];
  submitting: boolean;
  error: string | null;
  onSubmit: (values: GenerateDecisionValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<GenerateDecisionValues>({
    roomId: rooms[0]?.id ?? "",
    agentId: "",
  });

  function set<K extends keyof GenerateDecisionValues>(
    key: K,
    value: GenerateDecisionValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !values.roomId) return;
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">Generate decision summary</h2>
      <p className="mt-1 text-sm text-neutral-500">
        An AI teammate reads the room&apos;s recent messages and summarizes the
        decisions and next steps. The summary is saved to this workspace.
      </p>

      {rooms.length === 0 ? (
        <p className="mt-4 rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-500">
          Create a room and exchange some messages first — there&apos;s nothing
          to summarize yet.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="dec-room" className={labelClass}>
              Room
            </label>
            <select
              id="dec-room"
              value={values.roomId}
              onChange={(e) => set("roomId", e.target.value)}
              className={inputClass}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dec-agent" className={labelClass}>
              Summarized by
            </label>
            <select
              id="dec-agent"
              value={values.agentId}
              onChange={(e) => set("agentId", e.target.value)}
              className={inputClass}
            >
              <option value="">Default agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !values.roomId}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Generating…" : "Generate summary"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-500 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
