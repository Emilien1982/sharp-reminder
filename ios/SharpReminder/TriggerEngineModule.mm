#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <SharpReminderSpecs/SharpReminderSpecs.h>

// Doit précéder SharpReminder-Swift.h : l'en-tête généré depuis le Swift
// déclare `ReactNativeDelegate`, dont la superclasse est cette classe React.
// Sans cet import préalable, le compilateur voit une superclasse inconnue et
// échoue sur un fichier — AppDelegate.swift — que l'on ne touche même pas.
#import <React_RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>

// Même raison : l'en-tête généré déclare `LocationMonitor`, qui adopte
// `CLLocationManagerDelegate`. Sans CoreLocation importé au préalable, le
// compilateur bute sur un protocole inconnu, dans un fichier Objective-C++ qui
// ne parle pourtant jamais de localisation.
#import <CoreLocation/CoreLocation.h>

#import "SharpReminder-Swift.h"

/**
 * Implémentation iOS du module natif `TriggerEngine`.
 *
 * Fine par construction : elle ne fait qu'adapter les promesses React Native
 * aux appels de `TriggerEngineBridge`, écrit en Swift. Toute la logique vit
 * dans `TriggerEngine.swift`, joignable sans contexte React — c'est ce qui
 * permet au moteur de fonctionner application fermée.
 */
@interface TriggerEngineModule : NSObject <NativeTriggerEngineSpec>
@end

@implementation TriggerEngineModule

RCT_EXPORT_MODULE(TriggerEngine)

- (void)syncRules:(NSString *)snapshotJson
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  NSString *failure = [TriggerEngineBridge syncRules:snapshotJson];

  if (failure == nil) {
    resolve(nil);
  } else {
    // L'échec remonte au JavaScript plutôt que d'être avalé : une
    // synchronisation ratée signifie des rappels qui ne sonneront pas, ce que
    // l'utilisateur doit pouvoir constater.
    reject(@"SYNC_FAILED", failure, nil);
  }
}

- (void)getTriggerCosts:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  resolve([TriggerEngineBridge triggerCostsJson]);
}

- (void)drainFiredEvents:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  resolve([TriggerEngineBridge drainFiredEventsJson]);
}

/**
 * Le déclencheur Wi-Fi n'existe pas encore sur iOS : la réponse est donc
 * « non pris en charge », et jamais « aucun réseau ».
 *
 * La distinction compte pour l'éditeur : « aucun réseau » invite à se connecter
 * puis à réessayer, ce qui ne mènerait ici nulle part.
 * `NEHotspotNetwork.fetchCurrent` exige la capacité
 * `com.apple.developer.networking.wifi-info`, donc un profil de provisionnement
 * que ce projet n'a pas, et le simulateur n'a de toute façon aucun réseau à
 * rapporter.
 */
- (void)readCurrentWifi:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  resolve(@"{\"status\":\"unsupported\"}");
}

- (void)getDiagnostics:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  resolve([TriggerEngineBridge diagnosticsJson]);
}

- (std::shared_ptr<facebook::react::TurboModule>)
    getTurboModule:(const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeTriggerEngineSpecJSI>(params);
}

@end
