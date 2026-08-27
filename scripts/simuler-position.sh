#!/usr/bin/env bash
# Simule une position GPS sur l'appareil Android branché.
#
# Sert à éprouver les déclencheurs de lieu sans se déplacer : franchissement
# d'entrée, de sortie, et règles combinées. C'est le seul moyen de vérifier un
# géorepérage depuis un bureau.
#
#   ./scripts/simuler-position.sh 48.6921 6.1844          # 60 s par défaut
#   ./scripts/simuler-position.sh 48.6308 6.3037 180      # 3 minutes
#
# ⚠️ Piège coûteux, encodé ici : un fournisseur de position fictive est
# **détruit avec la session `adb shell` qui l'a créé**. Enchaîner les commandes
# depuis le Mac ne fonctionne donc pas — la position est rétablie avant même
# que le système ne l'ait propagée. Tout doit tenir dans une seule invocation,
# d'où la boucle exécutée sur l'appareil.
#
# Autorisation nécessaire une fois par appareil :
#   adb shell appops set --uid 2000 android:mock_location allow
# Pour la retirer :
#   adb shell appops set --uid 2000 android:mock_location default

set -euo pipefail

LATITUDE="${1:-}"
LONGITUDE="${2:-}"
DUREE="${3:-60}"

if [[ -z "$LATITUDE" || -z "$LONGITUDE" ]]; then
    echo "usage : $0 <latitude> <longitude> [durée en secondes]" >&2
    echo "exemple : $0 48.6921 6.1844 120" >&2
    exit 2
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

if ! adb get-state > /dev/null 2>&1; then
    echo "Aucun appareil Android joignable. Vérifier le câble et 'adb devices'." >&2
    exit 1
fi

if ! adb shell appops get --uid 2000 android:mock_location 2>/dev/null | grep -q allow; then
    echo "Position fictive non autorisée pour le shell. Lancer une fois :" >&2
    echo "  adb shell appops set --uid 2000 android:mock_location allow" >&2
    exit 1
fi

CYCLES=$(( DUREE / 5 ))
[[ "$CYCLES" -lt 1 ]] && CYCLES=1

echo "Position simulée : $LATITUDE, $LONGITUDE pendant ${DUREE} s."
echo "La position réelle revient dès la fin du script."

adb shell "
for p in fused gps network; do
    cmd location providers add-test-provider \$p
    cmd location providers set-test-provider-enabled \$p true
done
for i in \$(seq 1 $CYCLES); do
    for p in fused gps network; do
        cmd location providers set-test-provider-location \$p \
            --location $LATITUDE,$LONGITUDE --accuracy 5
    done
    sleep 5
done
"

echo "Terminé. Pour lire ce que le moteur en a fait :"
echo "  adb shell \"run-as com.sharpreminder cat /data/data/com.sharpreminder/shared_prefs/sharp_reminder_triggers.xml\""
