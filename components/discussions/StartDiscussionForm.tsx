"use client";

import { useState } from "react";
import { MIN_ROUNDS, MAX_ROUNDS, DEFAULT_ROUNDS } from "@/lib/discussion/validation";

// StartDiscussionForm — pick a room, a topic, the participating agents, and the
// number of rounds, then run a multi-agent discussion.
//
// Participants are optional: when none are selected the server uses the room's
// active agents. A discussion needs at least two agents; the form nudges toward
// that but the API enforces it.

export type RoomOption = { id: string; name: string };
export type AgentOption = { id: string; displayName: string };

export type StartDiscussionValues = {
  roomId: string;
  topic: string;
  agentIds: string[];
  rounds: number;
};

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const labelClass = "mb-1 block text-sm text-neutral-300";

export function StartDiscussionForm({
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
  onSubmit: (values: StartDiscussionValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<StartDiscussionValues>({
    roomId: rooms[0]?.id ?? "",
    topic: "",
    agentIds: [],
    rounds: DEFAULT_ROUNDS,
  });

  function set<K extends keyof StartDiscussionValues>(
    key: K,
    value: StartDiscussionValues[K]
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleAgent(id: string) {
    setValues((v) => ({
      ...v,
      agentIds: v.agentIds.includes(id)
        ? v.agentIds.filter((a) => a !== id)
        : [...v.agentIds, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !values.roomId || !values.topic.trim()) return;
    onSubmit({ ...values, topic: values.topic.trim() });
  }

  const roundsOptions: number[] = [];
  for (let r = MIN_ROUNDS; r <= MAX_ROUNDS; r++) roundsOptions.push(r);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-neutral-800 bg-neutral-900 p-5"
    >
      <h2 className="font-semibold">Start a discussion</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Two or more AI teammates discuss your topic over a few rounds, then
        summarize the consensus and the open disagreements.
      </p>

      {rooms.length === 0 ? (
        <p className="mt-4 rounded-md border border-neutral-800 px-3 py-2 text-sm text-neutral-500">
          Create a room with at least two AI agents first — a discussion needs a
          room to ground it.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="disc-room" className={labelClass}>
                Room
              </label>
              <select
                id="disc-room"
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
              <label htmlFor="disc-rounds" className={labelClass}>
                Rounds
              </label>
              <select
                id="disc-rounds"
                value={values.rounds}
                onChange={(e) => set("rounds", Number(e.target.value))}
                className={inputClass}
              >
                {roundsOptions.map((r) => (
                  <option key={r} value={r}>
                    {r} {r === 1 ? "round" : "rounds"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="disc-topic" className={labelClass}>
              Topic
            </label>
            <textarea
              id="disc-topic"
              value={values.topic}
              onChange={(e) => set("topic", e.target.value)}
              rows={3}
              placeholder="What should the team discuss? e.g. Should we use SQLite or Postgres for the MVP?"
              className={inputClass}
            />
          </div>

          <div>
            <span className={labelClass}>
              Participants{" "}
              <span className="text-neutral-500">
                (optional — defaults to the room&apos;s agents)
              </span>
            </span>
            {agents.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No active agents in this workspace yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {agents.map((a) => {
                  const checked = values.agentIds.includes(a.id);
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => toggleAgent(a.id)}
                      className={
                        "rounded-full border px-3 py-1 text-sm transition-colors " +
                        (checked
                          ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                          : "border-neutral-700 text-neutral-300 hover:border-neutral-500")
                      }
                    >
                      {a.displayName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !values.roomId || !values.topic.trim()}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Running discussion…" : "Start discussion"}
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
