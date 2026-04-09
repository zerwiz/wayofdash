# Fibonacci Information Architecture Rule

## Overview

Information is organized so that **breadth and depth follow Fibonacci scaling**: each level exposes a small, memorable number of choices (1, 2, 3, then 5, then 8), matching how humans scan hierarchies without overload. This rule is used in the **Way of** dashboard for docs navigation, task complexity levels, and planning milestones.

**Companion doc:** [Folder structure rules](./folder-structure-rules.md) (where `workspace/` content lives).

---

## Core principle

1. **One root truth** (Level 1) — dashboard / north-star context.
2. **Split into a Fibonacci-limited number of branches** at each depth — not arbitrary fan-out.
3. **Progressive disclosure** — deeper levels add detail; users can collapse or drill without losing place.

In the UI, the file tree and **DOCS** browser reflect this as nested folders and files; **TASKS** and **PLAN** screens use discrete levels **1, 2, 3, 5, 8** for complexity and milestone depth.

---

## Breadcrumb mental model

When moving from a deep node back to the root, the path reads like:

```text
Level 8 Deep Spec → [Parent: Level 5 Implementation]
Level 5 Implementation → [Parent: Level 3 Functional Area]
Level 3 Functional Area → [Parent: Level 2 Pillar]
Level 2 Pillar → [Parent: Level 1 Core Truth]
```

Or in generic form:

```text
Level 4 Node → [Parent: Level 3 Category A]
Level 3 Category A → [Parent: Level 2 Pillar I]
Level 2 Pillar I → [Parent: Level 1 Core Truth]
```

---

## Mathematical validation

The number of nodes at depth $D$ may be validated against Fibonacci counts: target breadth at depth $D$ aligns with $F_{D+1}$ when using strict Fibonacci fan-out (optional discipline for greenfield IA).

**Fibonacci sequence**

- $F_1 = 1$
- $F_2 = 1$
- $F_3 = 2$
- $F_4 = 3$
- $F_5 = 5$
- $F_6 = 8$
- $F_7 = 13$
- $F_8 = 21$
- …

**Depth mapping (illustrative)**

| Depth | Fibonacci number | Example node count |
|-------|------------------|---------------------|
| 0     | $F_2$            | 1                   |
| 1     | $F_3$            | 2                   |
| 2     | $F_4$            | 3                   |
| 3     | $F_5$            | 5                   |
| 4     | $F_6$            | 8                   |

**Validation formula (reference)**

$$\text{Nodes at depth } D = F_{D+1}$$

Where $F_n = F_{n-1} + F_{n-2}$ with $F_1 = 1$, $F_2 = 1$.

---

## Usage guidelines

### When to apply

- Designing information architectures and doc trees under `workspace/docs/` and `workspace/notes/`.
- Structuring navigation and progressive disclosure in the UI.
- Assigning **Fibonacci levels** to tasks and calendar milestones (summary → technical depth).

### When not to apply

- Flat lists with no hierarchy.
- Single long documents with no sections.
- Data that is inherently non-tree-shaped (use tags or graphs instead).

### Performance and UX

- Limit cognitive load at deep levels; prefer clear back navigation and breadcrumbs.
- The dashboard uses a **sidebar** (full layout on desktop, **drawer on narrow viewports**) and **breadcrumbs** in the browser view.

---

## Related patterns

- Progressive disclosure  
- Information hierarchy  
- Taxonomy design  

---

## Revision history

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0     | 2024-01-01 | Initial documentation |
| 1.1     | 2026-04-09 | Restored full document; linked `workspace/`, tasks/plan levels, folder-structure rules |

---

## License

This documentation is provided under the project’s standard license terms.

*Fibonacci Information Architecture Rule v1.1*
