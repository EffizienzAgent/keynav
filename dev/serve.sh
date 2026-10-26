#!/usr/bin/env bash
# Run inside the bench container; serves the desk on http://localhost:8010 (Administrator / admin)
set -euo pipefail
cd /home/frappe/bench-data/frappe-bench
exec bench serve --port 8000 --noreload
