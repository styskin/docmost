#!/bin/bash

set -euo pipefail

# === Configuration ===
DB_URI="postgresql://docmost:STRONG_DB_PASSWORD@localhost:5432/docmost"
S3_PREFIX="s3://manulbackup/postgres-backups"
TMP_DIR="$HOME/pg_restore_tmp"
mkdir -p "$TMP_DIR"

# === Get IMDSv2 Token ===
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# === Get IAM Role Name ===
ROLE_NAME=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/)

# === Optional: Get temporary AWS credentials (for logging/debugging only) ===
CREDENTIALS=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/$ROLE_NAME)

echo "🔐 Using IAM Role: $ROLE_NAME"
echo "🔄 Starting restore process..."

# === Find latest backup in S3 ===
LATEST_FILE=$(aws s3 ls "$S3_PREFIX/" | sort | tail -n 1 | awk '{print $4}')
if [[ -z "$LATEST_FILE" ]]; then
  echo "❌ No backup files found in $S3_PREFIX"
  exit 1
fi

echo "📦 Latest backup file: $LATEST_FILE"

# === Download backup file ===
LOCAL_FILE="${TMP_DIR}/${LATEST_FILE}"
echo "⬇️ Downloading $LATEST_FILE to $LOCAL_FILE..."
aws s3 cp "${S3_PREFIX}/${LATEST_FILE}" "$LOCAL_FILE"

# === Decompress ===
echo "📂 Decompressing $LOCAL_FILE..."
gunzip -f "$LOCAL_FILE"  # removes .gz, leaves .sql

SQL_FILE="${LOCAL_FILE%.gz}"

# === Restore to PostgreSQL ===
echo "🧩 Restoring from $SQL_FILE to $DB_URI..."
psql "$DB_URI" < "$SQL_FILE"

# === Clean up ===
echo "🧹 Cleaning up..."
rm -f "$SQL_FILE"

echo "✅ Restore completed successfully."
