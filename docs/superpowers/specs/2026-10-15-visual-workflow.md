# Visual workflow and connector acceptance criteria

The previous light theme retained a text-heavy hierarchy, repeated benefit copy and
generic integration links. This iteration makes the workflow visible while retaining
cool white and periwinkle as the main palette, with restrained mint and peach accents.

## Contracts

- The first desktop viewport contains an interactive product example beside concise
  copy. Small screens stack the example without horizontal overflow.
- A bundled 29-second recording can actually play and seek. Notes and action items
  are explicitly prepared sample outputs; tab changes never pretend to run inference.
- Three scenes show recording, extracted notes and a task's destinations. Animation
  is pausable, silent by default, stops offscreen and on keyboard interaction, and
  honors reduced motion. Audio completion preserves the focused control.
- GitHub and Gmail have recognizable marks, distinct visual previews and literal
  destination domains. Workspace previews use the current meeting's outgoing data.
- A valid repository and selected task are required for a GitHub issue draft. Native
  task/deadline fields survive formatting. Multiple tasks have individual previews.
- Gmail recipients contain known email addresses or the user's input, never invented
  speaker addresses. The preview matches the body in the actual compose URL, including
  an honest truncation notice and a full-copy alternative for long minutes.
- Draft actions open external composition screens for user review. Direct API issue
  creation remains a separate, explicitly immediate advanced action.
- Existing saved meetings, editing, inference and export formats remain available.

## Verification

Connector regressions cover task/deadline mapping, repository syntax, real recipients,
Unicode truncation and URL length. Browser checks cover actual audio playback/end focus,
arrow-key tabs, hash-preserving section navigation, desktop/mobile layout, and real
meeting previews without submitting an external issue or email. Run frontend tests,
lint, production build and dependency audit; obtain independent review and verify CI
for the published commit.

Verified locally on 2026-10-15: 84 frontend/script tests passed, ESLint and production
build passed, and the production dependency audit reported zero vulnerabilities.
Desktop at 1440×960 and mobile at 390×844 were inspected in the browser. The bundled
audio played successfully and its completion retained focus. A real saved sample's
second task matched the GitHub URL payload; invalid/empty selections removed its link.
The comprehensive Gmail draft matched its URL body exactly (1,895 characters including
the test recipient), with no external submission. Independent review's two keyboard
focus findings were fixed and re-reviewed with no remaining actionable findings.
