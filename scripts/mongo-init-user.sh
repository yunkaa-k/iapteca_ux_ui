#!/usr/bin/env bash

: "${MONGO_APP_USERNAME:?MONGO_APP_USERNAME is required}"
: "${MONGO_APP_PASSWORD:?MONGO_APP_PASSWORD is required}"

# setup-local.ps1 generates hexadecimal passwords so they are safe to embed
# in this one-time local initialization command. This script runs only when
# the MongoDB data directory is first initialized.
mongosh --quiet --host 127.0.0.1 \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval "const appDb = db.getSiblingDB('iapteca'); const appUser = '$MONGO_APP_USERNAME'; if (!appDb.getUser(appUser)) { appDb.createUser({ user: appUser, pwd: '$MONGO_APP_PASSWORD', roles: [{ role: 'readWrite', db: 'iapteca' }] }); }"
