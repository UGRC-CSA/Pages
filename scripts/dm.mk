# Focused DM workflow; all regular site targets keep their existing behavior.
#
# Messages works with or without Spring, so there are two preview paths:
#   dm-local    the page on its own, no backend at all (the usual one)
#   dm-preview  the page plus a packaged Spring, for the signed-in path
DM_PYTHON ?= python3
SPRING_DIR ?= ../Spring
DM_PROJECT = _projects/systems/direct-messages
DM_JEKYLL = cd .dm-preview/source && BUNDLE_GEMFILE=../../Gemfile bundle exec jekyll serve \
	--config ../../_config.yml,../../_config.dev.yml --source . --destination ../site \
	--host 127.0.0.1 --port 4500 --no-watch

.PHONY: dm-local dm-local-test dm-build dm-preview dm-frontend dm-test dm-check

# Build the page and its assets into the focused preview tree. No backend.
# Calls the project's own Makefile rather than build-registered-projects: the
# latter also regenerates the site-wide _sass/projects/_all.scss, which the
# preview does not use and which would be left listing only this project.
# Per-project Makefiles are generated from the template and not tracked, so on
# a fresh checkout this has to create it the same way build-registered-projects
# would.
dm-build:
	@if [ ! -f "$(DM_PROJECT)/Makefile" ]; then \
		echo "Generating Makefile for direct-messages (from template)"; \
		cp "_projects/_template/Makefile" "$(DM_PROJECT)/Makefile"; \
	fi
	$(MAKE) -C $(DM_PROJECT) build
	$(DM_PYTHON) scripts/prepare_dm_preview.py

# Serve Messages with no backend running: the page falls into local mode.
# Open http://localhost:4500/student/messages
dm-local: dm-build
	$(DM_JEKYLL)

# Browser checks for local mode. Run in a second terminal while dm-local serves.
dm-local-test:
	cd scripts/dm-tests && npm install --no-audit --no-fund
	node scripts/dm-tests/verify_local.mjs

dm-preview:
	$(DM_PYTHON) scripts/dm_preview.py --spring "$(SPRING_DIR)"

dm-frontend: dm-local

dm-test:
	$(MAKE) -C "$(SPRING_DIR)" test
	$(MAKE) dm-check

dm-check:
	$(DM_PYTHON) scripts/dm-tests/verify_migration.py "$(SPRING_DIR)"
	cd scripts/dm-tests && npm install --no-audit --no-fund
	node scripts/dm-tests/verify.mjs
