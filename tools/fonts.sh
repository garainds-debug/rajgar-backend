#!/usr/bin/env bash
# Downloads the two variable fonts (Latin subset) used by the app into the given folder.
set -euo pipefail
DEST=$1; mkdir -p "$DEST"
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
get () {  # family-query  file
  css=$(curl -fsSL -A "$UA" "https://fonts.googleapis.com/css2?family=$1&display=swap")
  url=$(printf '%s\n' "$css" | awk '/\/\* latin \*\//{f=1} f&&/src: url/{match($0,/https:[^)]+/); print substr($0,RSTART,RLENGTH); exit}')
  curl -fsSL "$url" -o "$DEST/$2"
  echo "$2 <- $url ($(stat -c%s "$DEST/$2") bytes)"
}
get 'Baloo+2:wght@400..800' baloo2.woff2
get 'Figtree:wght@300..900' figtree.woff2
