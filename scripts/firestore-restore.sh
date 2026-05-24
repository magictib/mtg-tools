#!/usr/bin/env bash
# ============================================================
# Restauration Firestore depuis un backup GCS
# ============================================================
#
# ⚠️ DESTRUCTIF — écrase les collections importées.
# Toujours tester d'abord sur un projet de staging.
#
# Usage :
#   bash scripts/firestore-restore.sh <date-du-backup>
#   ex: bash scripts/firestore-restore.sh 2026-05-23-0300
#
# Best practice : utilise --collection-ids pour restaurer uniquement
# certaines collections (ex: --collection-ids=public_decks,users).

PROJECT_ID="${FIREBASE_PROJECT_ID:-manalab-app}"
BUCKET="${FIRESTORE_BACKUP_BUCKET:-manalab-firestore-backups}"
BACKUP_DATE="${1:-}"

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage : $0 <date-du-backup> [--collection-ids=coll1,coll2]"
  echo ""
  echo "Backups disponibles :"
  gcloud storage ls "gs://$BUCKET/" --project="$PROJECT_ID"
  exit 1
fi

# Vérifications
if [ "$PROJECT_ID" = "manalab-app" ]; then
  echo "⚠️  Tu es sur le projet PRODUCTION : $PROJECT_ID"
  echo "    Pour restore sur staging : FIREBASE_PROJECT_ID=manalab-app-staging $0 $BACKUP_DATE"
  echo ""
  read -p "Continuer quand même ? Tape 'restore-prod' pour confirmer : " confirm
  if [ "$confirm" != "restore-prod" ]; then
    echo "✗ Annulé"
    exit 1
  fi
fi

echo "→ Restauration depuis gs://$BUCKET/$BACKUP_DATE/ vers $PROJECT_ID"

gcloud firestore import "gs://$BUCKET/$BACKUP_DATE" \
  --project="$PROJECT_ID" \
  --async \
  "${@:2}"

if [ $? -eq 0 ]; then
  echo "✓ Import lancé. Suivi :"
  echo "  gcloud firestore operations list --project=$PROJECT_ID"
else
  echo "✗ Échec"
  exit 1
fi
