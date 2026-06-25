<!-- Thanks for contributing! Keep PRs focused — one logical change per PR. -->

## Summary

<!-- What does this change and why? -->

Closes #

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (public API / behavior)
- [ ] Docs / tooling only

## Checklist

- [ ] `npx ng test angular-image-editor --watch=false` passes
- [ ] `npx ng lint` passes
- [ ] `npx ng build angular-image-editor` succeeds
- [ ] Tests added/updated for the change
- [ ] Public API + `README.md` updated (if the surface changed)
- [ ] No `any` / `@ts-ignore`; Fabric.js stays lazy-loaded (no top-level import in the initial bundle)
- [ ] Theming uses `--asp-*` tokens (no hard-coded colors)
