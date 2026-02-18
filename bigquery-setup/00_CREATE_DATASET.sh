#!/bin/bash
# ================================================================
# Create the lumoviz dataset in people-power-change project
# ================================================================
# Run this FIRST before running 00_MASTER_SETUP.sql
#
# Usage: bash 00_CREATE_DATASET.sh
# Or manually: bq mk --dataset people-power-change:lumoviz
# ================================================================

echo "Creating lumoviz dataset in people-power-change project..."

bq mk --dataset \
  --description "Lumoviz organizing data - teams, campaigns, actions, contacts, and meetings" \
  --location US \
  people-power-change:lumoviz

if [ $? -eq 0 ]; then
  echo "✅ Dataset created successfully!"
  echo ""
  echo "Next step: Run the master setup script to create all tables:"
  echo "  bq query --use_legacy_sql=false < 00_MASTER_SETUP.sql"
else
  echo "❌ Error creating dataset. It may already exist."
  echo "To check: bq ls people-power-change"
fi
