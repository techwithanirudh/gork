#!/bin/sh
set -e
chown bun:bun /usr/src/app/logs
exec gosu bun "$@"
