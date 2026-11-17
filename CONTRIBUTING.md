# Maintaining this fork

This repository continues [Kargatharaakash/grok-bot-mcp](https://github.com/Kargatharaakash/grok-bot-mcp). Preserve the upstream MIT license and attribution. Keep runtime changes in `server.mjs`, using Node.js built-ins.

## Local checks

```sh
node --check server.mjs
npm test
```

Tests use temporary home directories and local mock HTTP servers. Add a regression test for changes to message delivery, authentication or transcript decoding. Keep real accounts and Bot calls outside the automated suite.

Record user-visible changes in [CHANGELOG.md](CHANGELOG.md). Verify an actual sent message and its matching reply before claiming a live connection fix. An accepted send can precede the Bot's reply, so use `get_transcript` to read the result.

## Bringing in upstream changes

After cloning this fork, add the source repository once.

```sh
git remote add upstream https://github.com/Kargatharaakash/grok-bot-mcp.git
```

With a clean checkout, start a branch from the maintained main branch and merge the upstream changes for review.

```sh
git fetch origin
git fetch upstream
git switch -c codex/update-upstream origin/main
git merge upstream/main
npm test
```

Review the combined changes and CI results before updating `main`. Preserve the gateway fallback conditions and message ID across retries.

## Local credentials

Account tokens and gateway credentials belong in the user's `~/.gbm/` directory or environment. Review staged files before pushing. Test fixtures must use synthetic credentials and example addresses.
