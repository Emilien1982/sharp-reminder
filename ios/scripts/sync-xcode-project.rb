#!/usr/bin/env ruby
# frozen_string_literal: true

# Synchronise le projet Xcode avec les fichiers présents sur le disque.
#
# Le projet iOS de React Native référence ses fichiers explicitement, sans
# groupe synchronisé : tout fichier Swift ou Objective-C++ ajouté doit être
# déclaré dans project.pbxproj. Ce script le fait de façon idempotente et
# **vérifie que chaque source pointe vers un fichier existant** — un chemin
# erroné ne se manifeste sinon qu'après plusieurs minutes de compilation.
#
#   cd ios && bundle exec ruby scripts/sync-xcode-project.rb
#
# À relancer après chaque ajout de fichier natif (nouveau déclencheur, par
# exemple), puis `bundle exec pod install` si les dépendances ont changé.
#
# Pièges appris à nos dépens, tous encodés ici :
#  - le groupe « SharpReminder » a un chemin nul et pointe sur ios/ : ses
#    enfants portent donc le chemin complet depuis ios/ ;
#  - sans PRODUCT_NAME, la cible de test produit un bundle nommé « .xctest »
#    et deux commandes de build entrent en conflit ;
#  - la cible de test n'a pas d'hôte applicatif : elle recompile directement
#    les fichiers de logique pure, plutôt que d'imposer le démarrage de React
#    Native pour tester une fonction.

require 'xcodeproj'

PROJECT_PATH = 'SharpReminder.xcodeproj'
APP_TARGET = 'SharpReminder'
TEST_TARGET = 'SharpReminderTests'

# Fichiers de logique pure recompilés par la cible de test.
TESTABLE_SOURCES = %w[
  Evaluator.swift
  IsoTime.swift
  SignalSnapshot.swift
  TriggerCondition.swift
  RuleSnapshot.swift
].freeze

project = Xcodeproj::Project.open(PROJECT_PATH)
app_target = project.targets.find { |t| t.name == APP_TARGET }
abort "Cible #{APP_TARGET} introuvable" unless app_target

app_group = project.main_group[APP_TARGET]
abort "Groupe #{APP_TARGET} introuvable" unless app_group

added = []

# --- Sources natives de l'application ----------------------------------------

triggers_group = app_group['Triggers'] || app_group.new_group('Triggers')
# Le chemin est fixé explicitement à chaque exécution : un groupe créé sans
# chemin hériterait de ios/ et Xcode chercherait ios/Triggers/.
triggers_group.path = "#{APP_TARGET}/Triggers"

Dir.glob("#{APP_TARGET}/Triggers/*.swift").sort.each do |path|
  name = File.basename(path)
  next if triggers_group.files.any? { |f| f.display_name == name }

  app_target.add_file_references([triggers_group.new_reference(name)])
  added << path
end

Dir.glob("#{APP_TARGET}/*.mm").sort.each do |path|
  name = File.basename(path)
  existing = app_group.files.find { |f| f.display_name == name }

  if existing
    existing.path = "#{APP_TARGET}/#{name}"
  else
    app_target.add_file_references([app_group.new_reference("#{APP_TARGET}/#{name}")])
    added << path
  end
end

# --- Cible de test ------------------------------------------------------------

test_target = project.targets.find { |t| t.name == TEST_TARGET }
unless test_target
  test_target = project.new_target(:unit_test_bundle, TEST_TARGET, :ios, '16.0')
  test_target.add_dependency(app_target)
  added << "(cible #{TEST_TARGET})"
end

test_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.sharpreminder.tests'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
  config.build_settings['TEST_HOST'] = ''
  config.build_settings['BUNDLE_LOADER'] = ''
end

test_group = project.main_group[TEST_TARGET] ||
             project.main_group.new_group(TEST_TARGET, TEST_TARGET)

Dir.glob("#{TEST_TARGET}/*.swift").sort.each do |path|
  name = File.basename(path)
  next if test_group.files.any? { |f| f.display_name == name }

  test_target.add_file_references([test_group.new_reference(name)])
  added << path
end

TESTABLE_SOURCES.each do |name|
  ref = project.files.find { |f| f.display_name == name }
  next if ref.nil?
  next if test_target.source_build_phase.files_references.include?(ref)

  test_target.add_file_references([ref])
end

# Les cas de l'évaluateur sont partagés avec Jest et JUnit : les déclarer en
# ressource permet à XCTest de les lire depuis son bundle.
fixture = 'evaluator-cases.json'
unless test_group.files.any? { |f| f.display_name == fixture }
  test_target.add_resources([test_group.new_reference("../../shared/fixtures/#{fixture}")])
  added << "(ressource #{fixture})"
end

project.save

# --- Vérification : chaque source existe-t-elle vraiment ? --------------------

missing = []
[app_target, test_target].each do |target|
  target.source_build_phase.files.each do |build_file|
    ref = build_file.file_ref
    next if ref.nil?

    missing << [target.name, ref.real_path.to_s] unless File.exist?(ref.real_path)
  end
end

puts added.empty? ? 'Projet déjà à jour.' : "Ajoutés (#{added.size}) :"
added.each { |p| puts "  + #{p}" }
puts

if missing.empty?
  app_count = app_target.source_build_phase.files.count
  test_count = test_target.source_build_phase.files.count
  puts "✅ #{app_count} sources (app) et #{test_count} sources (tests) pointent toutes vers un fichier existant."
else
  puts "❌ #{missing.size} référence(s) cassée(s) — la compilation échouera :"
  missing.each { |target, path| puts "   [#{target}] #{path}" }
  exit 1
end
