#!/usr/bin/env bash
set -euo pipefail

mongosh --quiet --host localhost \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval '
    const hello = db.adminCommand({ hello: 1 });
    if (hello.setName && hello.setName !== "rs0") quit(1);
    if (hello.setName === "rs0" && hello.isWritablePrimary === true) quit(0);
    if (!hello.setName && hello.isreplicaset === true) {
      try {
        rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] });
      } catch (error) {
        // A concurrent healthcheck may already have initialized the set.
      }
    }
    quit(1);
  '
