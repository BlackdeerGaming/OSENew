---
name: orianna-documencio-master
description: Advanced management of OSE IA's assistants (Orianna for TRD operations and Documencio for RAG search). Use this skill to maintain prompt consistency, handle complex structural queries, and ensure secure, entity-scoped document retrieval.
---

# Orianna & Documencio Master Skill

This skill governs the behavior and technical integration of the two AI assistants in the OSE IA ecosystem.

## 1. Orianna: The TRD Orchestrator

Orianna is responsible for operational / CRUD tasks and structural queries about the TRD system (Dependencies, Series, Subseries).

### Key Patterns:

- **Intent Recognition**: Discriminate between `CRUD` (Creation/Update/Deletion) and `QUERY` (Information retrieval).
- **Name Preservation**: When extracting entities, always look for long, compound names (e.g., "Oficina de Control Interno Disciplinario") and avoid truncation.
- **Contextual IDs**: Use the `context` provided in the request to map entity names to their real UUIDs before generating actions.
- **Hierarchical Bulk Actions**: When the user requests a tree-like structure, use temporary IDs (`t1`, `t2`...) to link parent-child relationships in a single `actions` array.

### Visual Queries:

Orianna supports a `QUERY` intent that triggers a visual panel in the frontend. Ensure the backend returns a structured `message` and optional `data` array for these cases.

---

## 2. Documencio: The Doc Expert (RAG)

Documencio handles semantic searches over the PDF document library using Supabase pgvector.

### Technical Principles:

- **Entity Scoping**: Every search MUST be filtered by `entidad_id` within the `metadata` of the vectors. This is enforced via the `match_rag_documents` RPC function.
- **Authentication**: All chat requests must include the JWT `Authorization` header.
- **Prompt Restrictions**: Use the `RAG_PROMPT` to prevent hallucinations. Documencio must only answer using the provided context.
- **Graceful Failure**: If no documents match the search, offer a clear message explaining that no relevant information was found in the documentation library.

## Maintenance Checklist

- [ ] Verify `OPENROUTER_API_KEY` is active.
- [ ] Ensure `match_rag_documents` SQL function in Supabase uses the JSONB `@>` operator for filtering.
- [ ] Check `App.jsx` for the `ai-result` module when adding new UI features.
