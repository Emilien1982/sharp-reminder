package com.sharpreminder.triggers

import com.sharpreminder.triggers.model.SignalSnapshot
import com.sharpreminder.triggers.model.TriggerCondition
import com.sharpreminder.triggers.model.parseIsoInstant
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Vérifie l'évaluateur Kotlin sur `shared/fixtures/evaluator-cases.json`, le
 * même fichier que consomment Jest et XCTest.
 *
 * C'est le garde-fou central de l'architecture : l'évaluateur existe en trois
 * exemplaires, et rien d'autre n'empêcherait leurs comportements de diverger.
 */
class EvaluatorTest {

    private fun loadFixtures(): JSONObject {
        val stream = javaClass.classLoader!!.getResourceAsStream("evaluator-cases.json")
            ?: error(
                "evaluator-cases.json introuvable dans le classpath de test. " +
                    "Vérifier sourceSets.test.resources dans app/build.gradle."
            )
        return JSONObject(stream.bufferedReader().readText())
    }

    private fun signalFromJson(json: JSONObject): SignalSnapshot {
        fun stringSet(key: String): Set<String> {
            val array = json.getJSONArray(key)
            return (0 until array.length()).map { array.getString(it) }.toSet()
        }

        return SignalSnapshot(
            now = parseIsoInstant(json.getString("now")),
            wifiSsid = if (json.isNull("wifiSsid")) null else json.getString("wifiSsid"),
            connectedBluetoothDeviceIds = stringSet("connectedBluetoothDeviceIds"),
            insideLocationConditionIds = stringSet("insideLocationConditionIds"),
        )
    }

    @Test
    fun `le fichier de cas partagés est bien chargé`() {
        // Sans ce garde-fou, un classpath mal configuré donnerait zéro cas et
        // tous les tests passeraient sans rien vérifier.
        val cases = loadFixtures().getJSONArray("satisfactionCases")
        assertTrue(
            "Trop peu de cas chargés : ${cases.length()}",
            cases.length() > 20,
        )
    }

    @Test
    fun `satisfaction des conditions - tous les cas partagés`() {
        val cases = loadFixtures().getJSONArray("satisfactionCases")
        val failures = mutableListOf<String>()

        for (index in 0 until cases.length()) {
            val testCase = cases.getJSONObject(index)
            val name = testCase.getString("name")

            val conditions = TriggerCondition.listFromJson(
                testCase.getJSONArray("conditions")
            )
            val combinator = Evaluator.Combinator.fromWire(testCase.getString("combinator"))
            val signal = signalFromJson(testCase.getJSONObject("signal"))
            val expected = testCase.getBoolean("expected")

            val actual = Evaluator.areConditionsSatisfied(conditions, combinator, signal)
            if (actual != expected) {
                failures += "  ✗ $name → attendu $expected, obtenu $actual"
            }
        }

        // On collecte tous les échecs avant d'échouer : voir les cinq cas
        // divergents d'un coup vaut mieux que de les découvrir un par un.
        assertTrue(
            "Cas divergents entre Kotlin et la référence partagée :\n" +
                failures.joinToString("\n"),
            failures.isEmpty(),
        )
    }

    @Test
    fun `détection de la transition - tous les cas partagés`() {
        val cases = loadFixtures().getJSONArray("risingEdgeCases")

        for (index in 0 until cases.length()) {
            val testCase = cases.getJSONObject(index)
            assertEquals(
                testCase.getString("name"),
                testCase.getBoolean("expected"),
                Evaluator.shouldFire(
                    testCase.getBoolean("previous"),
                    testCase.getBoolean("current"),
                ),
            )
        }
    }

    @Test
    fun `un type de déclencheur inconnu fait échouer la lecture`() {
        val unknown = JSONObject("""{"id":"x","type":"meteo"}""")

        val error = runCatching { TriggerCondition.fromJson(unknown) }.exceptionOrNull()

        assertTrue(
            "Un type inconnu doit lever une exception, pas être ignoré",
            error is IllegalArgumentException,
        )
    }
}
