#!/usr/bin/env bash
# ============================================================
# Backup quotidien Firestore vers Google Cloud Storage
# ============================================================
#
# Setup une fois (depuis Cloud Shell ou local avec gcloud installé) :
#
#   PROJECT_ID="ton-projet-firebase"
#   BUCKET="manalab-firestore-backups"
#
#   1. Créer le bucket dédié aux backups (région EU pour RGPD) :
#      gcloud storage buckets create gs://$BUCKET \
#        --project=$PROJECT_ID \
#        --location=europe-west1 \
#        --uniform-bucket-level-access
#
#   2. Configurer une lifecycle policy : suppression auto après 30 jours
#      (création d'un fichier lifecycle.json puis applique-le)
#      Voir scripts/firestore-backup-lifecycle.json
#      gcloud storage buckets update gs://$BUCKET \
#        --lifecycle-file=scripts/firestore-backup-lifecycle.json
#
#   3. Donner au service account Firestore la permission d'écrire :
#      gcloud projects add-iam-policy-binding $PROJECT_ID \
#        --member=serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com \
#        --role=roles/datastore.importExportAdmin
#      gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
#        --member=serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com \
#        --role=roles/storage.objectAdmin
#
#   4. Planifier le cron avec Cloud Scheduler (free tier : 3 jobs gratuits) :
#      gcloud scheduler jobs create http firestore-daily-backup \
#        --project=$PROJECT_ID \
#        --location=europe-west1 \
#        --schedule="0 3 * * *" \
#        --time-zone="Europe/Paris" \
#        --uri="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default):exportDocuments" \
#        --http-method=POST \
#        --oauth-service-account-email=$PROJECT_ID@appspot.gserviceaccount.com \
#        --headers="Content-Type=application/json" \
#        --message-body="{\"outputUriPrefix\":\"gs://$BUCKET/$(date +%Y-%m-%d)\"}"
#
# Tester manuellement immédiatement :
#   bash scripts/firestore-backup.sh

PROJECT_ID="${FIREBASE_PROJECT_ID:-manalab-app}"
BUCKET="${FIRESTORE_BACKUP_BUCKET:-manalab-firestore-backups}"
DATE=$(date +%Y-%m-%d-%H%M)

if ! command -v gcloud &> /dev/null; then
  echo "Erreur : gcloud n'est pas installé. Voir https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "→ Export Firestore en cours vers gs://$BUCKET/$DATE/"

gcloud firestore export "gs://$BUCKET/$DATE" \
  --project="$PROJECT_ID" \
  --async

if [ $? -eq 0 ]; then
  echo "✓ Export lancé (async). Vérifie le statut avec :"
  echo "  gcloud firestore operations list --project=$PROJECT_ID"
else
  echo "✗ Échec de l'export"
  exit 1
fi

# Optionnel : test de restauration sur un projet de staging
#   gcloud firestore import gs://$BUCKET/$DATE/ \
#     --project=$PROJECT_ID-staging \
#     --async
