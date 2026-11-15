#!/usr/bin/env bash
# Installs the global skills listed in docs/toolbox.md into ~/.claude/skills, each pinned to one commit.
# Run it again any time: a skill already at its pinned commit is left alone. A failed download skips that
# skill and never stops a session from starting. To change a version, change its commit below.
set -u
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"

# fetch <owner/repo> <full commit>: one commit, no history, into $TMP/<repo>
fetch() {
  local dir="$TMP/${1#*/}"
  git init -q "$dir" && git -C "$dir" fetch -q --depth 1 "https://github.com/$1.git" "$2" \
    && git -C "$dir" checkout -q FETCH_HEAD && echo "$dir"
}
# put <folder> <name> <commit>: copies a skill folder into $DEST/<name>, without .git
put() {
  local to="$DEST/$2"
  if [ -f "$to/.pin" ] && [ "$(cat "$to/.pin")" = "$3" ]; then echo "skills: $2 already at ${3:0:7}"; return; fi
  rm -rf "$to" && mkdir -p "$to" && (cd "$1" && tar --exclude=.git --exclude=.github -cf - .) | (cd "$to" && tar xf -) \
    && echo "$3" > "$to/.pin" && echo "skills: $2 installed (${3:0:7})"
}
# one <owner/repo> <commit> <name>[:<subfolder>] ...
one() {
  local repo="$1" pin="$2" d; shift 2
  if ! d=$(fetch "$repo" "$pin"); then echo "skills: $repo skipped (download failed)"; return; fi
  for s in "$@"; do put "$d/${s#*:}" "${s%%:*}" "$pin"; done
}

one LiamGvchi/gc-minimal-zine-poster 4cb0396ad4e834019f753b37e1c4f415f5e02026 gc-minimal-zine-poster:.   # tag v0.1.0
one blader/humanizer 0ef9fe5bc3572734fd3ae6c448fe00a30cd5dcf0 humanizer:.
one axetroy/naturalize-writing aad997cd702d75674d2209243063af3890f5dfc3 naturalize-writing:.agents/skills/naturalize-writing
# CC BY-NC 4.0 (no commercial use). The four skills read ../shared, so it goes next to them.
one Imbad0202/academic-research-skills 6d9388674de1ad0437ad95db3d52f92b92204d84 \
  deep-research:deep-research academic-paper:academic-paper academic-paper-reviewer:academic-paper-reviewer \
  academic-pipeline:academic-pipeline shared:shared
