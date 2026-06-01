"use client";

import { useMemo, useState } from "react";
import type { Message } from "@/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { RightPanel } from "@/components/workspace/RightPanel";
import { parseMentions } from "@/lib/chat/mention-parser";
import {
  mockAgents,
  mockDecisions,
  mockMemory,
  mockMessages,
  mockMembers,
  mockProjectContext,
  mockRooms,
  mockUser,
  mockWorkspace,
} from "@/lib/mock-data";

/**
 * Top-level workspace UI. Wires the three-pane layout from the architecture
 * spec (left sidebar / center chat / right panel) using mock data.
 *
 * NOTE: AI responses are mocked locally. There is no real provider call here —
 * the AI Router (lib/ai/ai-router.ts) is a later build phase. The frontend must
 * never call AI providers directly.
 */
export function WorkspaceView() {
  const [activeRoomId, setActiveRoomId] = useState(mockRooms[0].id);
  const [messages, setMessages] = useState<Message[]>(mockMessages);

  const activeRoom = useMemo(
    () => mockRooms.find((r) => r.id === activeRoomId) ?? mockRooms[0],
    [activeRoomId],
  );

  const roomMessages = useMemo(
    () => messages.filter((m) => m.roomId === activeRoomId),
    [messages, activeRoomId],
  );

  function handleSend(content: string) {
    const { mentionedAgentIds, rawMentions } = parseMentions(content, mockAgents);

    const humanMessage: Message = {
      id: `msg_${Date.now()}`,
      roomId: activeRoomId,
      senderType: "human",
      userId: mockUser.id,
      senderName: mockUser.name,
      content,
      createdAt: new Date().toISOString(),
      metadata: { mentionedAgentIds, rawMentions },
    };

    setMessages((prev) => [...prev, humanMessage]);

    // Mocked agent responses — stands in for the future AI Router.
    // Selection rule: mentioned active agents, else the room default agent.
    const targetIds =
      mentionedAgentIds.length > 0
        ? mentionedAgentIds
        : activeRoom.defaultAgentId
          ? [activeRoom.defaultAgentId]
          : [];

    const responders = mockAgents.filter(
      (a) => targetIds.includes(a.id) && a.isActive,
    );

    responders.forEach((agent, i) => {
      const reply: Message = {
        id: `msg_${Date.now()}_${agent.id}`,
        roomId: activeRoomId,
        senderType: "agent",
        agentId: agent.id,
        senderName: agent.displayName,
        agentRole: agent.role,
        content: `(${agent.displayName} would respond here once the AI Router is connected. Provider: ${agent.provider}, model: ${agent.model}.)`,
        createdAt: new Date(Date.now() + (i + 1) * 600).toISOString(),
        metadata: { provider: agent.provider, model: agent.model },
      };
      setTimeout(() => setMessages((prev) => [...prev, reply]), (i + 1) * 600);
    });
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        workspace={mockWorkspace}
        rooms={mockRooms}
        members={mockMembers}
        activeRoomId={activeRoomId}
        onSelectRoom={setActiveRoomId}
      />
      <ChatPanel
        room={activeRoom}
        messages={roomMessages}
        agents={mockAgents}
        onSend={handleSend}
      />
      <RightPanel
        agents={mockAgents}
        projectContext={mockProjectContext}
        memory={mockMemory}
        decisions={mockDecisions}
      />
    </div>
  );
}
