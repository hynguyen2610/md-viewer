#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPOSITORY="${MD_VIEWER_REPOSITORY:-hynguyen2610/md-viewer}"
readonly API_URL="https://api.github.com/repos/${REPOSITORY}/releases/latest"

fail() {
  echo "md-viewer installer: $*" >&2
  exit 1
}

for command in curl dpkg-deb apt-get; do
  command -v "$command" >/dev/null 2>&1 || fail "required command not found: $command"
done

case "$(uname -m)" in
  x86_64) deb_arch="amd64" ;;
  *) fail "unsupported CPU architecture: $(uname -m)" ;;
esac

if [[ ${EUID} -eq 0 ]]; then
  sudo_command=()
else
  command -v sudo >/dev/null 2>&1 || fail "sudo is required when not running as root"
  sudo_command=(sudo)
fi

tmp_dir="$(mktemp -d /tmp/md-viewer-install.XXXXXXXX)"
[[ "$tmp_dir" == /tmp/md-viewer-install.* ]] || fail "could not create a safe temporary directory"
chmod 755 "$tmp_dir"

cleanup() {
  if [[ -n "${tmp_dir:-}" && "$tmp_dir" == /tmp/md-viewer-install.* ]]; then
    rm -rf -- "$tmp_dir"
  fi
}
trap cleanup EXIT

release_json="$tmp_dir/release.json"
package_path="$tmp_dir/md-viewer.deb"

echo "Finding the latest stable md-viewer release for ${deb_arch}..."
curl --fail --silent --show-error --location \
  --retry 3 \
  --header "User-Agent: md-viewer-linux-mint-installer" \
  --header "Accept: application/vnd.github+json" \
  --header "X-GitHub-Api-Version: 2022-11-28" \
  "$API_URL" \
  --output "$release_json"

asset_url="$({
  sed -n 's/.*"browser_download_url":[[:space:]]*"\([^"]*\)".*/\1/p' "$release_json"
} | grep -E "/[^/]+_${deb_arch}\.deb$" | head -n 1 || true)"

[[ -n "$asset_url" ]] || fail "the latest release has no ${deb_arch} Debian package"
[[ "$asset_url" == "https://github.com/${REPOSITORY}/releases/download/"* ]] \
  || fail "GitHub returned an unexpected download URL"

echo "Downloading ${asset_url##*/}..."
curl --fail --silent --show-error --location \
  --retry 3 \
  --header "User-Agent: md-viewer-linux-mint-installer" \
  "$asset_url" \
  --output "$package_path"
chmod 644 "$package_path"

package_name="$(dpkg-deb --field "$package_path" Package)"
package_arch="$(dpkg-deb --field "$package_path" Architecture)"
package_version="$(dpkg-deb --field "$package_path" Version)"

[[ "$package_name" == "md-viewer" ]] || fail "downloaded package is '$package_name', not 'md-viewer'"
[[ "$package_arch" == "$deb_arch" ]] || fail "downloaded package is for '$package_arch', not '$deb_arch'"

echo "Installing md-viewer ${package_version}..."
"${sudo_command[@]}" apt-get install -y "$package_path"

echo "md-viewer ${package_version} is installed. Run it with: md-viewer"
