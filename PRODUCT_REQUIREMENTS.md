HiveMind Product Requirements

MVP Goal

Build a working MVP where multiple human users and multiple AI agents can collaborate inside shared project rooms.

The MVP must prove this core experience:

A human user creates a workspace, creates a room, adds human teammates and AI agents, sends messages, mentions specific AI agents, stores shared project memory, stores project context, and generates decision summaries.

MVP Experience Example

A user creates a workspace called:

AI Team Up

The user creates a room called:

App Development

The room includes humans:

* Maya
* Another invited human teammate

The room includes AI agents:

* ARi
* Cloudy

The user sends:

@ARi design the database and @Cloudy review the architecture.

Expected result:

* ARi responds as a programmer / system architect
* Cloudy responds as a deep reasoning / review partner
* Both messages appear in the same room
* Human users can continue the conversation
* Messages are saved
* Memory is available
* Project context is available
* Decision summary can be generated

Core MVP Features

The MVP must include:

1. Workspace System
2. Room System
3. Human Chat
4. Human Team Collaboration
5. AI Agent System
6. Mention System
7. AI Router
8. Provider Abstraction Layer
9. Shared Memory
10. Project Context
11. Decision Summary
12. Basic UI Layout

Feature 1: Workspace System

A workspace is the top-level container for a project or team.

Examples:

* AI Team Up
* Cafe Business Plan
* University Group Project
* App Development
* Game Design Project
* Research Project
* Startup Launch

Users must be able to:

* Create a workspace
* View workspace details
* Open a workspace
* See rooms inside a workspace
* See human members inside a workspace
* See AI agents inside a workspace

Workspace fields should include:

* id
* name
* description
* ownerId
* createdAt
* updatedAt

Feature 2: Room System

A room is a focused project discussion inside a workspace.

Examples:

* General
* Product Planning
* Coding
* Marketing
* Finance
* Research
* Branding
* Design Review

Users must be able to:

* Create rooms
* Open rooms
* View messages inside rooms
* Send messages inside rooms
* Add AI agents to rooms
* Select a default AI agent for a room

Room fields should include:

* id
* workspaceId
* name
* description
* defaultAgentId
* createdAt
* updatedAt

Feature 3: Human Chat

Human users must be able to send and view messages in a room.

Message types:

* Human message
* AI agent message
* System message

Messages should show:

* Sender name
* Sender type
* Content
* Timestamp
* Agent role if sender is AI
* Model/provider metadata if available

Message fields should include:

* id
* roomId
* senderType
* userId optional
* agentId optional
* content
* metadata
* createdAt

Feature 4: Human Team Collaboration

Human collaboration is core.

The app must support multiple human users per workspace.

Workspace member roles:

Owner:

* Can manage everything
* Can invite users
* Can manage rooms
* Can manage agents
* Can manage memory
* Can manage project context

Admin:

* Can manage rooms
* Can invite users
* Can manage agents
* Can manage memory

Member:

* Can chat
* Can mention AI agents
* Can view memory
* Can generate summaries if allowed

Viewer:

* Can read only
* Cannot send messages
* Cannot call AI agents

For MVP:

* Store invitations in database
* Actual email sending can be added later
* Invitation status can be pending / accepted / rejected
* Invite by email is enough

Invitation fields:

* id
* workspaceId
* email
* role
* status
* createdAt

Feature 5: AI Agent System

AI agents must be database-driven.

Do not hard-code ARi or Cloudy directly into the chat logic.

Each AI agent must have:

* id
* workspaceId
* name
* displayName
* provider
* model
* role
* systemPrompt
* avatarUrl optional
* isActive
* createdAt
* updatedAt

Default agents should be created for a new workspace:

ARi

name:
ari

displayName:
ARi

provider:
openai

model:
Use a reasonable OpenAI model placeholder.

role:
System Architect / Programmer

systemPrompt:
You are ARi, an AI system architect and programmer inside HiveMind. You represent the OpenAI / ChatGPT side of the team. You help users design systems, write code, debug, plan architecture, and turn ideas into working products. Be direct, practical, structured, and implementation-focused. You work well with Cloudy.

Cloudy

name:
cloudy

displayName:
Cloudy

provider:
anthropic

model:
Use a reasonable Claude model placeholder.

role:
Deep Reasoning / Review Partner

systemPrompt:
You are Cloudy, a deep reasoning AI collaborator inside HiveMind. You represent the Claude AI / Anthropic side of the team. You review ideas, detect weaknesses, improve logic, refine plans, and explain complex systems clearly. You are careful, structured, and thoughtful. You work well with ARi.

Feature 6: Room Agent Membership

A workspace may have many AI agents.

A room may include some of those AI agents.

Use a join table:

RoomAgent

Fields:

* id
* roomId
* agentId
* createdAt

Rules:

* A room can have multiple agents
* An agent can be in multiple rooms
* A room should be able to define one default agent
* Inactive agents should not respond

Feature 7: Mention System

The mention system must detect mentions in messages.

Examples:

@ARi help me design the database.

@Cloudy review this plan.

@ARi @Cloudy compare these two options.

Mention matching should be case-insensitive.

Examples:

@ari should match ARi.

@cloudy should match Cloudy.

For MVP, mention detection should support AI agents.

Future versions should also support human user mentions.

Mention rules:

1. If a message mentions one AI agent, only that AI agent responds.
2. If a message mentions multiple AI agents, all mentioned AI agents respond.
3. If a message has no AI mention, the room default agent responds.
4. If no default agent exists, ARi responds.
5. If a mentioned agent is inactive, it should not respond.
6. If a mentioned agent is not in the room, the system should either ignore it or show a clear system message.
7. If one AI provider fails, other AI agents should still respond.

Feature 8: AI-to-AI Mention Support

MVP does not need full automatic AI-to-AI orchestration yet.

However, architecture must be designed to support it later.

Future requirement:

AI agents can mention other AI agents.

Example:

ARi:
@Cloudy please review this technical decision.

System:
Cloudy is invited to respond.

This means message metadata should be able to store mentions.

Message metadata should support:

* mentionedAgentIds
* mentionedUserIds
* provider
* model
* error
* triggeredByAgentId
* triggeredByMessageId

Feature 9: AI Router

All AI calls must go through the backend AI Router.

Frontend must never call AI providers directly.

AI Router responsibilities:

1. Receive roomId, userId, and content
2. Save the human message
3. Load room
4. Load workspace
5. Load active room agents
6. Extract mentions
7. Select target agents
8. Build context
9. Call correct provider adapter
10. Save AI responses
11. Return AI responses

AI Router must support multiple agents in one message.

Example:

User sends:
@ARi @Cloudy help me decide.

Router should:

* Select ARi
* Select Cloudy
* Build context
* Call OpenAI provider for ARi
* Call Anthropic provider for Cloudy
* Save both responses
* Return both responses

Feature 10: Provider Abstraction Layer

The app must support multiple AI providers using a common interface.

Required providers:

* OpenAIProvider
* AnthropicProvider
* GeminiProvider placeholder

All providers must implement the same interface.

Common provider interface:

generateResponse(input) -> Promise

Input should include:

* model
* systemPrompt
* messages

Provider abstraction exists so future AI models can be added easily.

Future providers may include:

* Google Gemini
* Perplexity
* Mistral
* DeepSeek
* Local models
* Company-specific models

Feature 11: Shared Memory

Memory stores important long-term information.

Memory is not the same as normal chat history.

Examples:

* Brand direction
* Project constraints
* User preferences
* Important technical decisions
* Business assumptions
* Product decisions
* Long-term facts

Memory fields:

* id
* workspaceId
* roomId optional
* title
* content
* importance
* createdAt
* updatedAt

Users must be able to:

* Add memory
* View memory
* Edit memory
* Delete memory

AI Router must inject important memory into AI context.

Memory should be compact and curated.

Feature 12: Project Context

ProjectContext is higher priority than MemoryItem.

ProjectContext stores the stable identity and direction of the workspace.

Examples:

* Project name
* Mission
* Target users
* Core principles
* Non-negotiable rules
* Long-term direction
* Product positioning
* Architecture principles

ProjectContext fields:

* id
* workspaceId
* title
* content
* createdAt
* updatedAt

ProjectContext must be separate from MemoryItem.

Reason:

Memory may contain many smaller facts.

ProjectContext contains the high-level identity and mission.

AI Router must inject ProjectContext before MemoryItem.

Feature 13: Decision Summary

Users must be able to generate decision summaries from recent room messages.

Decision summary should include:

* Main topic
* Key ideas
* Options discussed
* Decisions made
* Action items
* Open questions

Decision fields:

* id
* workspaceId
* roomId optional
* title
* summary
* actionItems
* createdAt

Decision summaries should be saved and visible in the right panel.

Feature 14: Basic UI Layout

MVP UI should be simple but feel like a workspace.

Required layout:

Left Sidebar:

* Workspace name
* Room list
* Create room button
* Human member list

Center:

* Chat messages
* Message input
* Mention support

Right Panel:

* AI agents
* Project context
* Memory
* Decisions

Design style:

* Clean
* Dark mode first
* Team workspace feel
* Similar to Slack / Discord / Microsoft Teams
* Not a plain chatbot page
* Not a static knowledge base

MVP Definition of Done

The MVP is done when:

1. User can create workspace
2. User can create room
3. User can send human message
4. Messages are saved
5. User can add ARi and Cloudy to room
6. User can mention @ARi
7. User can mention @Cloudy
8. User can mention both @ARi and @Cloudy
9. Correct AI agents respond
10. Multiple AI responses appear in the same room
11. Shared memory exists
12. Project context exists
13. Decision summary works
14. Human collaboration model exists
15. Invitation model exists
16. App can run locally without production services
17. Frontend does not call AI providers directly
18. AI agents are database-driven
19. ProjectContext and MemoryItem are separate
20. App does not behave like a knowledge base app

Priority Rule

Do not build advanced features before the core collaboration loop works.

Core collaboration loop:

Human user sends message
→ Mentions AI
→ AI responds in same room
→ Human teammates can see it
→ Memory and decisions persist

Build this first.
