#!/bin/bash

set -euo pipefail

# === Config ===
DB_URI="postgresql://docmost:STRONG_DB_PASSWORD@localhost:5432/docmost"
S3_BUCKET="s3://manulbackup/postgres-backups"
BACKUP_DIR="/tmp/pg_backup"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILE_NAME="docmost_${DATE}.sql.gz"

# === Get IMDSv2 Token ===
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# === Get IAM Role Name ===
ROLE_NAME=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/)

# === Optional: Get temporary AWS credentials (for logging/debugging only) ===
CREDENTIALS=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/$ROLE_NAME)

echo "Using IAM Role: $ROLE_NAME"
echo "Starting backup at $DATE..."

# === Create backup directory ===
mkdir -p "$BACKUP_DIR"

# === Dump PostgreSQL using URI and compress ===
pg_dump "$DB_URI" | gzip > "${BACKUP_DIR}/${FILE_NAME}"

# === Upload to S3 ===
aws s3 cp "${BACKUP_DIR}/${FILE_NAME}" "$S3_BUCKET/"

# === Clean up local backup ===
rm -f "${BACKUP_DIR}/${FILE_NAME}"

echo "Backup complete and uploaded to $S3_BUCKET/$FILE_NAME"