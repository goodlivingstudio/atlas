# Clients Layer

Per-engagement context. Each client gets its own subfolder.

## Structure
```
clients/
└── [client-slug]/
    ├── brief.md              # Engagement brief and scope
    ├── strategy.md           # Strategic direction and decisions
    ├── competitive.md        # Competitive landscape
    └── decisions.md          # Key decisions and rationale log
```

## Usage
Client documents are loaded selectively per session — not always in context. When starting a client session, declare the engagement context so Atlas retrieves from the right subfolder.

## Update frequency
Per-engagement. Updated as context evolves.

## Privacy note
Client documents contain confidential information. This directory is gitignored by default. Do not commit client files to version control.
