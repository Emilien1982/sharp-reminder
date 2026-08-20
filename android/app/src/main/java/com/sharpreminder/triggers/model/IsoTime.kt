package com.sharpreminder.triggers.model

import java.time.Instant
import java.time.OffsetDateTime

/**
 * Lecture des instants ISO 8601 produits par la couche JavaScript.
 *
 * `Instant.parse` n'accepte que la forme se terminant par `Z` et rejette les
 * décalages explicites comme `2026-08-20T20:00:00+02:00`, que
 * `Date.toISOString` ne produit pas mais qu'un sélecteur de date local peut
 * très bien générer. `OffsetDateTime` accepte les deux formes.
 */
fun parseIsoInstant(value: String): Instant = OffsetDateTime.parse(value).toInstant()
