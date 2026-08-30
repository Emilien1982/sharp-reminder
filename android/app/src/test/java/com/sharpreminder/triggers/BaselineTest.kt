package com.sharpreminder.triggers

import com.sharpreminder.triggers.model.RuleSnapshot
import com.sharpreminder.triggers.model.TriggerCondition
import java.time.Instant
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Garde le correctif du rappel modifié qui ne sonnait plus jamais.
 *
 * Ce défaut n'était visible qu'à l'usage, après un premier déclenchement suivi
 * d'une modification — aucune vérification automatique existante ne pouvait
 * l'atteindre. D'où ces cas, qui figent la règle de réinitialisation.
 */
class BaselineTest {

    private val lieu = TriggerCondition.Location(
        id = "c-lieu",
        latitude = 48.63,
        longitude = 6.30,
        radiusMeters = 150f,
        onEnter = true,
    )

    private fun regle(
        conditions: List<TriggerCondition> = listOf(lieu),
        combinator: Evaluator.Combinator = Evaluator.Combinator.AND,
        body: String = "Acheter du pain",
    ) = RuleSnapshot(
        reminderId = "r-1",
        notificationBody = body,
        combinator = combinator,
        conditions = conditions,
    )

    @Test
    fun `une regle inconnue recoit une ligne de base`() {
        assertTrue(Baseline.needsReset(null, regle()))
    }

    @Test
    fun `une regle inchangee garde sa ligne de base`() {
        // Sinon chaque synchronisation réarmerait toutes les règles, et un
        // rappel déjà satisfait sonnerait à chaque écriture en base.
        assertFalse(Baseline.needsReset(regle(), regle()))
    }

    @Test
    fun `changer l'heure reinitialise la ligne de base`() {
        // Le cas réel : un rappel déjà déclenché dont on change l'heure ne
        // sonnait plus jamais, sa base étant restée à « satisfait ».
        val avant = regle(
            conditions = listOf(
                lieu,
                TriggerCondition.DateTime("c-date", Instant.parse("2026-08-24T11:28:00Z")),
            ),
        )
        val apres = regle(
            conditions = listOf(
                lieu,
                TriggerCondition.DateTime("c-date", Instant.parse("2026-08-24T17:00:00Z")),
            ),
        )

        assertTrue(Baseline.needsReset(avant, apres))
    }

    @Test
    fun `changer le combinateur reinitialise la ligne de base`() {
        assertTrue(
            Baseline.needsReset(
                regle(combinator = Evaluator.Combinator.AND),
                regle(combinator = Evaluator.Combinator.OR),
            ),
        )
    }

    @Test
    fun `ajouter une condition reinitialise la ligne de base`() {
        assertTrue(
            Baseline.needsReset(
                regle(conditions = listOf(lieu)),
                regle(
                    conditions = listOf(
                        lieu,
                        TriggerCondition.DateTime("c-date", Instant.parse("2026-08-24T17:00:00Z")),
                    ),
                ),
            ),
        )
    }

    @Test
    fun `changer le texte ne reinitialise rien`() {
        // Le texte n'influe pas sur la satisfaction : le réarmer ferait sonner
        // une règle déjà vraie pour une simple correction de faute de frappe.
        assertFalse(Baseline.needsReset(regle(body = "Avant"), regle(body = "Après")))
    }
}
