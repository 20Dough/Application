HiveMind Architecture

Architecture Goal

Build HiveMind as a scalable Human + AI Team Collaboration Platform.

Do not build it as a simple chatbot.

Do not build it as a knowledge base.

Do not build it as a CRUD-only app.

Recommended Tech Stack

Frontend:

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* shadcn/ui

Backend:

* Next.js API Routes
* TypeScript

Database:

* Prisma ORM
* SQLite for development
* PostgreSQL-compatible schema for production

Authentication:

* Placeholder auth for MVP
* Future Clerk integration

AI Providers:

* OpenAI for ARi
* Anthropic for Cloudy
* Gemini placeholder for future

Realtime:

* Normal fetch for MVP
* Future Socket.io or Supabase Realtime

Deployment:

* Local first
* Future Vercel + Supabase / Neon

High-Level Architecture

Frontend UI
→ Next.js API Routes
→ Workspace Service
→ Room Service
→ Message Service
→ AI Router
→ Provider Adapters
→ External AI Providers

Core Layers

1. Frontend Layer

Responsible for:

* Rendering workspaces
* Rendering rooms
* Rendering chat messages
* Sending user messages
* Displaying AI responses
* Showing agent list
* Showing memory
* Showing project context
* Showing decisions

Frontend must not directly call OpenAI, Anthropic, Gemini, or other AI APIs.

2. API Layer

Responsible for:

* Workspace CRUD
* Room CRUD
* Message handling
* Agent management
* Memory management
* Project context management
* Decision summary generation
* Permission checks
* Calling backend services

3. Collaboration Layer

Responsible for:

* Human users
* Workspace membership
* Roles
* Invitations
* Rooms
* Messages
* Human + AI participation

4. AI Orchestration Layer

Responsible for:

* Mention parsing
* Agent selection
* Context building
* Provider routing
* AI response saving
* Error handling

5. Provider Layer

Responsible for:

* OpenAI calls
* Anthropic calls
* Gemini placeholder
* Future providers

Each provider must follow the same interface.

Required Core Entities

Use these entities:

User
Workspace
WorkspaceMember
Invitation
Room
Message
Agent
RoomAgent
MemoryItem
ProjectContext
Decision
UsageLog

Entity Definitions

User

Represents a human user.

Fields:

* id
* email
* name
* avatarUrl
* createdAt
* updatedAt

Workspace

Represents a project or team.

Fields:

* id
* name
* description
* ownerId
* createdAt
* updatedAt

WorkspaceMember

Connects human users to workspaces.

Fields:

* id
* userId
* workspaceId
* role
* createdAt

Unique constraint:

* userId + workspaceId

Invitation

Stores invited users.

Fields:

* id
* workspaceId
* email
* role
* status
* createdAt

Room

Represents a focused discussion space.

Fields:

* id
* workspaceId
* name
* description
* defaultAgentId
* createdAt
* updatedAt

Message

Represents a chat message.

Fields:

* id
* roomId
* senderType
* userId optional
* agentId optional
* content
* metadata
* createdAt

senderType can be:

* human
* agent
* system

Agent

Represents an AI teammate.

Fields:

* id
* workspaceId
* name
* displayName
* provider
* model
* role
* systemPrompt
* avatarUrl
* isActive
* createdAt
* updatedAt

Unique constraint:

* workspaceId + name

RoomAgent

Connects agents to rooms.

Fields:

* id
* roomId
* agentId
* createdAt

Unique constraint:

* roomId + agentId

MemoryItem

Stores long-term memory.

Fields:

* id
* workspaceId
* roomId optional
* title
* content
* importance
* createdAt
* updatedAt

ProjectContext

Stores high-priority project identity and mission.

Fields:

* id
* workspaceId
* title
* content
* createdAt
* updatedAt

Decision

Stores decision summaries.

Fields:

* id
* workspaceId
* roomId optional
* title
* summary
* actionItems
* createdAt

UsageLog

Tracks AI usage.

Fields:

* id
* userId optional
* workspaceId optional
* provider
* model
* inputTokens optional
* outputTokens optional
* totalCost optional
* createdAt

Prisma Requirement

Create Prisma models for all core entities.

Use SQLite-compatible schema for development.

Keep schema conceptually compatible with PostgreSQL for production.

Agent Identity Architecture

HiveMind separates AI identity from AI provider.

Users interact with identities.

The system interacts with providers.

Example:

Identity:
ARi

Provider:
OpenAI

Model:
GPT / ChatGPT model

Role:
System Architect / Programmer

Example:

Identity:
Cloudy

Provider:
Anthropic

Model:
Claude model

Role:
Deep Reasoning / Review Partner

This allows future model upgrades without changing the user-facing teammate identity.

Agent Architecture Rule

Every AI agent must be database-driven.

Correct architecture:

Agent record:

* provider
* model
* role
* systemPrompt
* room membership

Incorrect architecture:

Hard-coded if statements such as:

if agent is ARi, call OpenAI directly in random component.

Do not do this.

AI Router Architecture

AI Router must be the only place where AI orchestration happens.

File suggestion:

lib/ai/ai-router.ts

AI Router flow:

1. Receive roomId, userId, content
2. Load room
3. Load workspace
4. Load human sender
5. Load active room agents
6. Extract mentions
7. Select target agents
8. Build context
9. Call provider adapters
10. Save AI responses
11. Return AI responses

Agent Selection Logic

Input:

* content
* active room agents
* defaultAgentId

Rules:

1. Extract mentions from content.
2. Match mentions to active agents by name or displayName.
3. If matched agents exist, select them.
4. If no matched agents, select default room agent.
5. If no default room agent, select ARi.
6. If selected agent is inactive, skip.
7. If no valid agent exists, save a system message.

Mention Parser Architecture

File suggestion:

lib/chat/mention-parser.ts

The parser should detect:

@ARi
@Cloudy
@Researcher

Requirements:

* Case-insensitive
* No duplicate mentions
* Return normalized mention names
* Future-ready for human user mentions

Metadata should store:

* mentionedAgentIds
* mentionedUserIds
* rawMentions

AI-to-AI Mention Future Architecture

Do not fully implement automatic AI-to-AI delegation in MVP unless simple.

But design metadata and message model so it can support:

* Agent mentions another agent
* System detects mention
* Mentioned agent is invited to respond
* Response is linked to original message

Future metadata fields:

* triggeredByAgentId
* triggeredByMessageId
* autoInvoked
* mentionType

Context Builder Architecture

File suggestion:

lib/memory/context-builder.ts

Context priority order:

1. Agent system prompt
2. ProjectContext
3. Workspace info
4. Room info
5. Important MemoryItems
6. Recent Decisions
7. Recent Messages
8. Current User Message

ProjectContext must come before MemoryItem.

Never send unlimited chat history.

Use recent messages only.

MVP can use latest 30 messages.

Context Format

Format context clearly:

Workspace:
Name:
Description:

Project Context:

* title: content

Room:
Name:
Description:

Important Memory:

* title: content

Recent Decisions:

* title: summary

Recent Conversation:
Human Maya: …
ARi: …
Cloudy: …

Current Message:
…

Provider Adapter Interface

File suggestion:

lib/ai/types.ts

Create common interface:

AIProvider
generateResponse(input): Promise

Input:

* model
* systemPrompt
* messages

Output:

* string

Providers:

* OpenAIProvider
* AnthropicProvider
* GeminiProvider placeholder

Provider factory:

getProvider(providerName)

Supported providers:

* openai
* anthropic
* gemini

Unknown provider should throw safe server-side error.

AI Error Handling

If one AI provider fails, do not fail the whole request.

Example:

User mentions:
@ARi @Cloudy

ARi succeeds.
Cloudy fails.

Result:

* Save ARi response
* Save system message:
    Cloudy could not respond right now.
* Do not roll back the whole user message.

Do not expose raw API errors to user.

Log raw errors server-side only.

Required API Routes

Workspaces

POST /api/workspaces
GET /api/workspaces
GET /api/workspaces/[workspaceId]
PATCH /api/workspaces/[workspaceId]
DELETE /api/workspaces/[workspaceId]

Rooms

POST /api/rooms
GET /api/rooms?workspaceId=
GET /api/rooms/[roomId]
PATCH /api/rooms/[roomId]
DELETE /api/rooms/[roomId]

Messages

POST /api/messages
GET /api/messages?roomId=

Agents

POST /api/agents
GET /api/agents?workspaceId=
PATCH /api/agents/[agentId]
DELETE /api/agents/[agentId]

Room Agents

POST /api/room-agents
DELETE /api/room-agents/[id]

Memory

POST /api/memory
GET /api/memory?workspaceId=
PATCH /api/memory/[memoryId]
DELETE /api/memory/[memoryId]

Project Context

POST /api/project-context
GET /api/project-context?workspaceId=
PATCH /api/project-context/[contextId]
DELETE /api/project-context/[contextId]

Decision Summary

POST /api/summaries/decision
GET /api/decisions?workspaceId=

Invitations

POST /api/invitations
GET /api/invitations?workspaceId=

Frontend Folder Structure

Recommended folders:

app/
components/
lib/
prisma/

Component groups:

components/layout
components/chat
components/workspace
components/agents
components/memory
components/decisions

Backend libraries:

lib/db.ts
lib/auth.ts
lib/permissions.ts
lib/ai
lib/chat
lib/memory
lib/summary

UI Layout Requirement

Main workspace page should have:

Left Sidebar:

* Workspace name
* Room list
* Create room button
* Human member list

Center:

* Active room name
* Message list
* Message input
* Mention support

Right Panel:

* AI agents
* Project context
* Shared memory
* Decisions

Security Rules

1. Never expose AI API keys to frontend.
2. All AI calls must happen server-side.
3. Check workspace membership before showing workspace data.
4. Check user role before modifying agents, memory, or project context.
5. Sanitize user-generated content.
6. Do not store secret API keys in messages.
7. Log raw errors server-side only.
8. Do not show raw provider errors to users.

Development Mode Rules

For MVP:

* Use SQLite locally
* Use placeholder auth if Clerk is not available
* Use fake current user if needed
* Keep auth abstraction clean so Clerk can be added later
* Keep schema PostgreSQL-compatible conceptually
* Keep AI API keys in .env only

Build Order

Build in this order:

Phase 1:
Project setup, Prisma schema, SQLite database, placeholder auth, base layout

Phase 2:
Workspace system

Phase 3:
Room system

Phase 4:
Human chat

Phase 5:
Agent system

Phase 6:
AI provider abstraction

Phase 7:
AI Router

Phase 8:
Mention system

Phase 9:
Project Context and Memory

Phase 10:
Decision Summary

Phase 11:
Human collaboration and invitations

Phase 12:
Polish, error states, loading states, deployment preparation

Non-Negotiable Architecture Rules

1. HiveMind is Human Team + AI Team + Shared Workspace.
2. AI agents must be database-driven.
3. Frontend must never call AI providers directly.
4. ProjectContext must exist separately from MemoryItem.
5. Humans and AI agents are both room participants conceptually.
6. Mention system must be designed for Human → AI, Human → Human, AI → Human, and AI → AI.
7. ARi represents OpenAI / ChatGPT.
8. Cloudy represents Claude AI / Anthropic.
9. Do not turn HiveMind into a knowledge base app.
10. Do not turn HiveMind into a single-user chatbot.
11. Do not turn HiveMind into a model comparison app.
12. Build collaboration first.
13. Keep provider adapters modular.
14. Keep code scalable for future agents.
15. Always prioritize the core collaboration loop.

Final Instruction

These three files are the permanent source of truth for HiveMind. Before making any major implementation decision, read these files first. Use them as permanent context for all future work.
