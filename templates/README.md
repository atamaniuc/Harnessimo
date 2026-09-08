# templates/

**This directory is package payload, not this repository's harness.**

`harnessimo init` copies it into a project that is adopting the tool, so everything here is
a starter document written for someone else: placeholder rules, an empty track index, a
queue with no items. The repository's own harness — its real constraints, its real progress,
its real queue — lives in `.harness/` and `specs/` at the root.

The two have the same shape on purpose: what a consumer gets is what this project uses. They
must not have the same content, or adopting the tool would import this project's rules along
with it. `test/templates.test.ts` checks that.

Do not fix a rule here by copying one from `.harness/`. Write the general version.
