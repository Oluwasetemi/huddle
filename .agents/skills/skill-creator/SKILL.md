---
name: skill-creator
description: Create or improve agent skills. Use when the user wants to make a new SKILL.md, turn a repeated workflow into a reusable skill, audit or refactor an existing skill, tune trigger descriptions, add scripts/references/assets, validate skill packaging, or compare skill performance against examples.
---

# Skill Creator

Create skills as compact operating procedures for future agents. A good skill changes behavior reliably because it gives the agent the right workflow, resources, and invocation pointer without bloating context.

## Source synthesis

This skill combines the useful parts of three public skill-creator patterns:

- Anthropic: intent capture, eval-driven iteration, baseline comparison, feedback loops, and description optimization.
- OpenAI: concise skills, progressive disclosure, degrees of freedom, resource folders, validation, and avoiding extra docs inside the skill folder.
- Agent Skills Kit: concrete use cases, trigger phrases, resource planning, security-safe frontmatter, packaging checks, and iteration signals.

Use the local `writing-for-agents` guidance as the authority for wording: context pointers, progressive disclosure, completion criteria, leading words, pruning, and invocation choice.

## Workflow

### 1. Establish the skill's job

Extract what is already known from the conversation before asking questions. Then fill only the missing gaps:

- What repeated task or workflow should the skill make easier?
- What should trigger it? Capture realistic user phrases, not abstract labels.
- What outputs should it produce?
- What tools, MCPs, commands, files, APIs, or domain rules does it rely on?
- What would count as success on 2-3 concrete examples?

Completion criterion: you can describe the skill in one sentence, name 2-3 realistic trigger prompts, and state the expected output or behavior for each.

### 2. Choose invocation and scope

Decide whether the skill should be model-invoked or user-invoked.

- Model-invoked: include a strong `description` when the agent should discover the skill on its own or other skills should reach it.
- User-invoked: use `disable-model-invocation: true` when only the human will call it explicitly.

Keep scope tight. If two branches need different workflows, split by branch or put branch-specific details in `references/`.

Completion criterion: the trigger boundary is clear enough to avoid both under-triggering and frequent false positives.

### 3. Plan resources before writing prose

Classify reusable material:

- `scripts/`: deterministic or repeated operations the agent would otherwise rewrite.
- `references/`: docs, policies, schemas, examples, or long guidance loaded only when needed.
- `assets/`: templates, images, boilerplate, fixtures, or files used in output.

Prefer scripts for fragile exactness. Prefer references for details that only some branches need. Prefer assets for files copied or modified, not read as instructions.

Do not add `README.md`, changelogs, install notes, or extra documentation inside the skill folder unless the target skill system explicitly requires them. Put agent-facing instructions in `SKILL.md` or `references/`.

Completion criterion: every planned file has a reason tied to a concrete use case.

### 4. Draft `SKILL.md`

Use this structure unless the skill needs a different shape:

```markdown
---
name: kebab-case-name
description: What the skill does. Use when the user says/needs [specific triggers and contexts].
---

# Title

One-paragraph purpose.

## Workflow

1. Step with a checkable completion criterion.
2. Step with a checkable completion criterion.
3. Step with a checkable completion criterion.

## Resources

- Read `references/example.md` when...
- Run `scripts/example.py ...` when...
```

Writing rules:

- Put trigger information in frontmatter, because the body loads only after invocation.
- Use imperative steps: inspect, decide, write, validate, report.
- Keep `SKILL.md` focused on the common path. Move branch details to `references/`.
- Preserve one source of truth. Do not duplicate the same rule in body and reference files.
- Explain why important constraints exist when that reason changes behavior.
- State positive target behavior before using prohibitions.
- Use exact commands for scripts and validation.

Completion criterion: another agent can run the skill without needing the original conversation.

### 5. Validate the skill mechanically and semantically

Mechanical checks:

- Folder name matches `name`.
- Name is kebab-case.
- Frontmatter is valid YAML.
- Description includes what the skill does and when to use it.
- References named in `SKILL.md` exist.
- Scripts are executable when intended and have been run at least once if changed.

Semantic checks:

- The description is a sharp context pointer with realistic triggers.
- The body starts with the workflow, not exposition.
- Each step has a completion criterion.
- Long or branch-specific material is disclosed behind references.
- The skill avoids restating information the environment can reveal cheaply.

Completion criterion: validation passes and the skill's trigger boundary is understandable from the description alone.

### 6. Test on examples when useful

Use lightweight examples by default. Full eval harnesses are optional and best for skills with objective outputs or high reuse.

For each example, record:

- Prompt: what the user would say.
- Expected behavior: what the skill should cause the agent to do.
- Evidence: file output, command result, transformed data, or review notes.

For a stronger test, compare against a baseline without the skill or against the previous skill version. Look for behavior change, not just whether the final answer is plausible.

Completion criterion: the skill improves at least one realistic example without causing obvious regressions or over-triggering.

### 7. Iterate from evidence

When results are weak, diagnose the failure mode:

- Under-triggering: sharpen the description with missing user phrases and contexts.
- Over-triggering: narrow the description or add explicit near-miss exclusions.
- Instructions ignored: move critical steps earlier, shorten surrounding prose, or make the completion criterion more checkable.
- Inconsistent exact work: replace prose with a script.
- Bloated skill: move branch details to references or delete no-op guidance.

Iterate on one hard example until the behavior is stable, then generalize the improvement. Do not overfit instructions to a single prompt.

## Report format

When creating or updating a skill, finish with:

- Skill path
- Trigger boundary summary
- Resources added or changed
- Validation performed
- Remaining risks or open questions
