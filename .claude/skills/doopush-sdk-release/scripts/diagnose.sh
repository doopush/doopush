#!/usr/bin/env bash
# Diagnose which DooPush SDKs need a new release. See ../SKILL.md for output interpretation.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "ERROR: not inside a git repository" >&2
  exit 1
fi
cd "$REPO_ROOT"

if [ ! -d "sdk/ios/DooPushSDK" ] || [ ! -d "sdk/android/DooPushSDK" ] || [ ! -d "sdk/react-native/DooPushSDK" ]; then
  echo "ERROR: not in doopush monorepo (no sdk/{ios,android,react-native}/DooPushSDK)" >&2
  exit 1
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "main" ]; then
  echo "ERROR: 必须在 main 分支发版（当前: $current_branch）" >&2
  echo "→ 先把 dev/feature 分支的工作合并到 main，再回来跑诊断" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: 工作区有未提交改动，发版前必须干净" >&2
  echo "" >&2
  git status --short >&2
  echo "" >&2
  echo "→ 先 commit 或 stash，再回来跑诊断" >&2
  exit 1
fi

extract_version() {
  local file pattern
  case "$1" in
    iOS)     file="sdk/ios/DooPushSDK/DooPushSDK.podspec";     pattern='^[[:space:]]*spec\.version' ;;
    Android) file="sdk/android/DooPushSDK/lib/build.gradle";   pattern='SDK_VERSION' ;;
    RN)      file="sdk/react-native/DooPushSDK/package.json";  pattern='"version"' ;;
  esac
  grep -E "$pattern" "$file" 2>/dev/null \
    | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' \
    | head -1 || true
}

version_file() {
  case "$1" in
    iOS)     echo "sdk/ios/DooPushSDK/DooPushSDK.podspec" ;;
    Android) echo "sdk/android/DooPushSDK/lib/build.gradle" ;;
    RN)      echo "sdk/react-native/DooPushSDK/package.json" ;;
  esac
}

sdk_path() {
  case "$1" in
    iOS)     echo "sdk/ios/DooPushSDK" ;;
    Android) echo "sdk/android/DooPushSDK" ;;
    RN)      echo "sdk/react-native/DooPushSDK" ;;
  esac
}

last_bump_commit() {
  local sdk="$1" version="$2" file
  file=$(version_file "$sdk")
  git log -1 --format=%H -S"$version" -- "$file" 2>/dev/null || true
}

bump_type_from_commits() {
  local msgs="$1"
  if printf '%s' "$msgs" | grep -qiE 'BREAKING CHANGE|^[a-f0-9]+ [a-z]+(\([^)]+\))?!:'; then
    echo "major"
  elif printf '%s' "$msgs" | grep -qE '^[a-f0-9]+ feat(\(|:)'; then
    echo "minor"
  else
    echo "patch"
  fi
}

next_version() {
  local cur="$1" type="$2" maj min pat
  maj=$(echo "$cur" | cut -d. -f1)
  min=$(echo "$cur" | cut -d. -f2)
  pat=$(echo "$cur" | cut -d. -f3)
  case "$type" in
    major) echo "$((maj+1)).0.0" ;;
    minor) echo "$maj.$((min+1)).0" ;;
    patch) echo "$maj.$min.$((pat+1))" ;;
  esac
}

version_ge() {
  printf '%s\n%s\n' "$2" "$1" | sort -V -C
}

echo "# DooPush SDK Release Diagnosis"
echo
echo "## Per-SDK"
echo

for sdk in iOS Android RN; do
  ver=$(extract_version "$sdk")
  path=$(sdk_path "$sdk")

  if [ -z "$ver" ]; then
    echo "- $sdk  (could not read version from $(version_file "$sdk"))  →  CHECK MANUALLY"
    echo
    continue
  fi

  bump_commit=$(last_bump_commit "$sdk" "$ver")
  if [ -z "$bump_commit" ]; then
    echo "- $sdk  v$ver  ·  no commit found that introduced this version  →  CHECK MANUALLY"
    echo
    continue
  fi

  bump_short=$(git rev-parse --short "$bump_commit")
  log_oneline=$(git log "$bump_commit"..HEAD --oneline -- "$path" 2>/dev/null || true)
  count=$(printf '%s' "$log_oneline" | grep -c '^' || true)

  if [ "$count" -eq 0 ]; then
    echo "- $sdk  v$ver  (last bump $bump_short)  ·  0 commits since  →  SKIP"
    echo
    continue
  fi

  bump_type=$(bump_type_from_commits "$log_oneline")
  next=$(next_version "$ver" "$bump_type")

  echo "- $sdk  v$ver  (last bump $bump_short)  ·  $count commits since  →  RELEASE ($bump_type, suggest $next)"
  printf '%s\n' "$log_oneline" | sed 's/^/    /'
  echo
done

echo "## Cross-SDK coupling (read from sdk/react-native/DooPushSDK/README.md)"
echo

rn_readme="sdk/react-native/DooPushSDK/README.md"
ios_ver=$(extract_version iOS)
android_ver=$(extract_version Android)

ios_required=$(grep -oE 'iOS 原生 SDK ≥ \*\*[0-9]+\.[0-9]+\.[0-9]+\*\*' "$rn_readme" 2>/dev/null \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
android_required=$(grep -oE 'Android 原生 SDK ≥ \*\*[0-9]+\.[0-9]+\.[0-9]+\*\*' "$rn_readme" 2>/dev/null \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)

if [ -n "$ios_required" ]; then
  if version_ge "$ios_ver" "$ios_required"; then
    echo "- RN requires iOS ≥ $ios_required  ·  current $ios_ver  ✓"
  else
    echo "- RN requires iOS ≥ $ios_required  ·  current $ios_ver  ✗ (bump iOS first)"
  fi
else
  echo "- RN requires iOS ≥ ?  ·  could not parse README (check 'iOS 原生 SDK ≥ **X.Y.Z**' line)"
fi

if [ -n "$android_required" ]; then
  if version_ge "$android_ver" "$android_required"; then
    echo "- RN requires Android ≥ $android_required  ·  current $android_ver  ✓"
  else
    echo "- RN requires Android ≥ $android_required  ·  current $android_ver  ✗ (bump Android first)"
  fi
else
  echo "- RN requires Android ≥ ?  ·  could not parse README (check 'Android 原生 SDK ≥ **X.Y.Z**' line)"
fi

