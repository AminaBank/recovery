TAG    := fireblocks-recovery
CACHE  := fireblocks-recovery-cache
DIST_DIR := dist
UID := $(shell id -u)
GID := $(shell id -g)

.PHONY: builder build run clean

builder: ## Build the Docker image
	docker build \
		--tag $(TAG) \
		--build-arg UID=$(UID) \
		--build-arg GID=$(GID) \
		.

build: builder ## Build the app in Docker
	@mkdir -p $(DIST_DIR)
	docker run \
		--rm \
		--init \
		--volume $(CURDIR)/$(DIST_DIR):/workspace/dist \
		--volume $(CACHE):/home/node/.cache \
		$(TAG) \
		sh -c 'yarn build && rm -f dist/*.AppImage && cp apps/recovery-utility/dist/*.AppImage dist/'
	@ls -lh $(DIST_DIR)/*.AppImage 2>/dev/null || echo "no AppImage present"

run: ## Launch the built AppImage on the host
	@app=$$(ls -1 $(DIST_DIR)/*.AppImage 2>/dev/null | head -1); \
	[ -n "$$app" ] || { echo "nothing to run — try: make build" >&2; exit 1; }; \
	chmod +x "$$app"; \
	if ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then \
	  exec "$$app"; \
	else \
	  exec "$$app" --appimage-extract-and-run; \
	fi

clean: ## Remove the image, the cache volume and build output
	docker rmi -f $(TAG)
	docker volume rm -f $(CACHE)
	rm -rf $(DIST_DIR)
