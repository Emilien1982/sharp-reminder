package com.sharpreminder.triggers

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONObject

/**
 * Implémentation Android du module natif `TriggerEngine`.
 *
 * Fine par construction : toute la logique vit dans `TriggerEngine`, joignable
 * depuis un `BroadcastReceiver` sans contexte React. C'est ce qui permet au
 * moteur de fonctionner application fermée — un module React qui porterait la
 * logique serait inaccessible dès que le moteur JavaScript s'arrête.
 */
@ReactModule(name = NativeTriggerEngineSpec.NAME)
class TriggerEngineModule(
    reactContext: ReactApplicationContext,
) : NativeTriggerEngineSpec(reactContext) {

    private val context = reactContext.applicationContext

    override fun syncRules(snapshotJson: String, promise: Promise) {
        runCatching { TriggerEngine.syncRules(context, snapshotJson) }
            .onSuccess { promise.resolve(null) }
            .onFailure { error ->
                // L'échec remonte au JavaScript plutôt que d'être avalé : une
                // synchronisation ratée signifie des rappels qui ne sonneront
                // pas, ce que l'utilisateur doit pouvoir constater.
                promise.reject("SYNC_FAILED", error.message, error)
            }
    }

    override fun getTriggerCosts(promise: Promise) {
        runCatching {
            val costs = TriggerRegistry(context).costs()
            JSONObject(costs as Map<*, *>).toString()
        }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("COSTS_FAILED", it.message, it) }
    }

    override fun drainFiredEvents(promise: Promise) {
        runCatching { RuleSnapshotStore(context).drainFiredEvents() }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("DRAIN_FAILED", it.message, it) }
    }

    override fun getDiagnostics(promise: Promise) {
        runCatching {
            val store = RuleSnapshotStore(context)
            val rules = store.loadRules()
            val registry = TriggerRegistry(context).apply { reconcile(rules) }

            JSONObject()
                .put("activeTriggerTypes", registry.activeTypeNames())
                .put("ruleCount", rules.size)
                .put("lastSignalAt", store.lastSignals())
                .toString()
        }
            .onSuccess { promise.resolve(it) }
            .onFailure { promise.reject("DIAGNOSTICS_FAILED", it.message, it) }
    }
}
