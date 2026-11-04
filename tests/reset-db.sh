#!/bin/sh
# Vide le faux Firebase de test (local uniquement)
curl -s -X POST http://localhost:9998/__reset > /dev/null && echo "✔ Faux Firebase vidé"
