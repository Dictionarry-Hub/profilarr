<script lang="ts">
	import InfoModal from '$ui/modal/InfoModal.svelte';

	export let open = false;
</script>

<InfoModal bind:open header="How Rename Works">
	<div class="space-y-6">
		<!-- Overview -->
		<div>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Overview</h3>
			<p class="text-sm text-neutral-600 dark:text-neutral-400">
				The rename feature scans your library and renames files that don't match your Radarr/Sonarr
				naming format. This helps keep your library organized and consistent without manual
				intervention.
			</p>
		</div>

		<!-- Process -->
		<div>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Process</h3>
			<ol class="list-decimal space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
				<li>Fetches all movies/series from your arr instance</li>
				<li>Excludes items with the ignore tag (if configured)</li>
				<li>Compares current file names against your naming format</li>
				<li>Triggers rename commands for files that need updating</li>
			</ol>
		</div>

		<!-- Settings -->
		<div>
			<h3 class="mb-2 font-semibold text-neutral-900 dark:text-neutral-100">Settings</h3>
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="font-medium text-neutral-900 dark:text-neutral-100">Dry Run</dt>
					<dd class="text-neutral-600 dark:text-neutral-400">
						Shows what files would be renamed without making changes. Use this to preview before
						committing. Folder renames cannot be previewed because the Arr API does not support it,
						so a live run may also rename folders not shown here.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-neutral-900 dark:text-neutral-100">Rename Folders</dt>
					<dd class="text-neutral-600 dark:text-neutral-400">
						Also rename movie/series folders to match the naming format. Requires a metadata refresh
						after completion.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-neutral-900 dark:text-neutral-100">Ignore Tag</dt>
					<dd class="text-neutral-600 dark:text-neutral-400">
						Items with this tag in your arr will be skipped. Useful for items you want to keep with
						custom names.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-neutral-900 dark:text-neutral-100">Schedule</dt>
					<dd class="text-neutral-600 dark:text-neutral-400">
						How often to check for files needing rename. Daily is usually sufficient for most
						libraries.
					</dd>
				</div>
				<div>
					<dt class="font-medium text-neutral-900 dark:text-neutral-100">Summary Notifications</dt>
					<dd class="text-neutral-600 dark:text-neutral-400">
						When enabled, sends a compact notification with the total count and one sample rename.
						When disabled, sends detailed notifications listing every renamed file.
					</dd>
				</div>
			</dl>
		</div>
	</div>
</InfoModal>
