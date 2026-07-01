<script lang="ts">
	import InfoModal from '$ui/modal/InfoModal.svelte';

	export let open = false;
</script>

<InfoModal bind:open header="How Rename Works">
	<div class="space-y-6">
		<!-- Overview -->
		<div>
			<h3 class="mb-2 font-semibold text-text">Overview</h3>
			<p class="text-sm text-text-soft">
				The rename feature scans your library and renames files that don't match your Radarr/Sonarr
				naming format. This helps keep your library organized and consistent without manual
				intervention.
			</p>
		</div>

		<!-- Process -->
		<div>
			<h3 class="mb-2 font-semibold text-text">Process</h3>
			<ol class="list-decimal space-y-1 pl-5 text-sm text-text-soft">
				<li>Fetches all movies/series from your arr instance</li>
				<li>Excludes items with the ignore tag (if configured)</li>
				<li>Compares current file names against your naming format</li>
				<li>Triggers rename commands for files that need updating</li>
			</ol>
		</div>

		<!-- Settings -->
		<div>
			<h3 class="mb-2 font-semibold text-text">Settings</h3>
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="font-medium text-text">Dry Run</dt>
					<dd class="text-text-soft">
						Shows what would be renamed without making changes. Use this to preview before
						committing.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-text">Rename Folders</dt>
					<dd class="text-text-soft">
						Also rename movie/series folders to match the naming format. Requires a metadata refresh
						after completion.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-text">Ignore Tag</dt>
					<dd class="text-text-soft">
						Items with this tag in your arr will be skipped. Useful for items you want to keep with
						custom names.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-text">Schedule</dt>
					<dd class="text-text-soft">
						How often to check for files needing rename. Daily is usually sufficient for most
						libraries.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-text">Summary Notifications</dt>
					<dd class="text-text-soft">
						When enabled, sends a compact notification with the total count and one sample rename.
						When disabled, sends detailed notifications listing every renamed file.
					</dd>
				</div>
			</dl>
		</div>
	</div>
</InfoModal>
