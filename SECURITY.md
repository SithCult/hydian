# Security

Hydian runs next to the game and reads its combat log; the backend holds what shared characters send. A report
is welcome for anything that widens that: a way to make the app write into game folders or read files other
than `combat_*.txt` / `.ini`, a leak of private notes or the journal, or a backend response that carries more
than a shared character's name, status and place.

- Email: **security@hydian.org**
- Or a [private vulnerability report](https://github.com/SithCult/hydian/security/advisories/new) on GitHub.

Include steps to reproduce. You get an answer within a few days; fixes ship as a patch release and the report is
credited unless you prefer otherwise. Please keep security reports out of public issues, and test against your
own backend rather than the hosted one.

| In scope                                                      | Out of scope                          |
| ------------------------------------------------------------- | ------------------------------------- |
| `apps/desktop` (client + Tauri shell), `apps/api`, `apps/web` | The game itself, third-party services |
| The hosted instance at `api.hydian.org` / `hydian.org`        | Denial of service, rate-limit probing |
