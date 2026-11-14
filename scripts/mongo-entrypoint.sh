#!/usr/bin/env bash
set -euo pipefail

source_key_file="/run/secrets/mongo-keyfile"
persistent_key_file="/data/db/.rs-keyfile"

if [[ ! -s "$source_key_file" ]]; then
  echo "Local MongoDB key file is missing or empty." >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "The local MongoDB entrypoint must start as root to set key file permissions." >&2
  exit 1
fi

if [[ ! -f "$persistent_key_file" ]]; then
  install -o mongodb -g mongodb -m 400 "$source_key_file" "$persistent_key_file"
else
  chown mongodb:mongodb "$persistent_key_file"
  chmod 400 "$persistent_key_file"
fi

exec /usr/local/bin/docker-entrypoint.sh mongod \
  --replSet rs0 \
  --bind_ip_all \
  --keyFile "$persistent_key_file"
