<script lang="ts">
	import type { PageData } from './$types';
	import { Info, FolderOpen, Database, HelpCircle, Heart, Package } from 'lucide-svelte';
	import VersionBadge from './components/VersionBadge.svelte';
	import Table from '$ui/table/Table.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';

	export let data: PageData;

	type InfoRowData = {
		key: string;
		label: string;
		value: string;
		type: 'code' | 'link' | 'text';
		href?: string;
	};

	type MigrationRow = (typeof data.migration.applied)[0];
	type ReleaseRow = {
		tag_name: string;
		html_url: string;
		published_at: string;
		prerelease: boolean;
	};
	type Section = {
		title: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon?: any;
		rows: InfoRowData[];
	};

	const appRows: InfoRowData[] = [
		{ key: 'version', label: 'Version', value: data.version, type: 'code' },
		{ key: 'timezone', label: 'Timezone', value: data.timezone, type: 'code' }
	];

	const sections: Section[] = [
		{
			title: 'Paths',
			icon: FolderOpen,
			rows: [
				{ key: 'base', label: 'Base Path', value: data.paths.base, type: 'code' },
				{ key: 'data', label: 'Data Directory', value: data.paths.data, type: 'code' },
				{ key: 'logs', label: 'Logs Directory', value: data.paths.logs, type: 'code' },
				{ key: 'database', label: 'Database Path', value: data.paths.database, type: 'code' }
			]
		},
		{
			title: 'Getting Support',
			icon: HelpCircle,
			rows: [
				{
					key: 'docs',
					label: 'Documentation',
					value: 'https://dictionarry.dev/',
					type: 'link',
					href: 'https://dictionarry.dev/'
				},
				{
					key: 'github',
					label: 'GitHub',
					value: 'https://github.com/Dictionarry-Hub',
					type: 'link',
					href: 'https://github.com/Dictionarry-Hub'
				},
				{
					key: 'discord',
					label: 'Discord',
					value: 'https://discord.gg/XGdTJP5G8a',
					type: 'link',
					href: 'https://discord.gg/XGdTJP5G8a'
				}
			]
		},
		{
			title: 'Support',
			icon: Heart,
			rows: [
				{
					key: 'sponsors',
					label: 'GitHub Sponsors',
					value: 'https://github.com/sponsors/Dictionarry-Hub',
					type: 'link',
					href: 'https://github.com/sponsors/Dictionarry-Hub'
				},
				{
					key: 'coffee',
					label: 'Buy Me a Coffee',
					value: 'https://www.buymeacoffee.com/santiagosayshey',
					type: 'link',
					href: 'https://www.buymeacoffee.com/santiagosayshey'
				}
			]
		}
	];

	const infoColumns: Column<InfoRowData>[] = [
		{ key: 'label', header: 'Label', width: 'w-40' },
		{ key: 'value', header: 'Value' }
	];

	const migrationColumns: Column<MigrationRow>[] = [
		{ key: 'version', header: 'Version', sortable: true, width: 'w-32' },
		{ key: 'name', header: 'Name', sortable: true },
		{ key: 'applied_at', header: 'Applied', sortable: true, width: 'w-32' }
	];

	const releaseColumns: Column<ReleaseRow>[] = [
		{ key: 'tag_name', header: 'Release' },
		{ key: 'published_at', header: 'Published', width: 'w-32' },
		{ key: 'prerelease', header: 'Type', width: 'w-24' }
	];
</script>

<div class="p-4 md:p-8">
	<h1 class="mb-6 text-3xl font-bold text-neutral-900 dark:text-neutral-50">About Profilarr</h1>

	<div class="space-y-6">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<Info class="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
				<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Application</h2>
			</div>
			<Table columns={infoColumns} data={appRows} responsive>
				<svelte:fragment slot="cell" let:row let:column>
					{#if column.key === 'label'}
						<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
							{row.label}
						</span>
					{:else if column.key === 'value'}
						{#if row.key === 'version'}
							<div class="flex items-center gap-2">
								<Label variant="secondary" size="md" rounded="md" mono>
									v{row.value}
								</Label>
								{#await data.streamed.releasesData}
									<div class="animate-pulse">
										<div class="h-6 w-20 rounded-full bg-neutral-200 dark:bg-neutral-800"></div>
									</div>
								{:then releasesData}
									<VersionBadge status={releasesData.versionStatus} />
								{:catch}
									<VersionBadge status={data.versionStatus} />
								{/await}
							</div>
						{:else if row.type === 'code'}
							<Label variant="secondary" size="md" rounded="md" mono>
								{row.value}
							</Label>
						{:else if row.type === 'link'}
							<Label
								variant="link"
								size="md"
								rounded="md"
								mono
								href={row.href}
								target="_blank"
								rel="noopener noreferrer"
							>
								{row.value}
							</Label>
						{:else}
							<span class="text-sm text-neutral-600 dark:text-neutral-400">{row.value}</span>
						{/if}
					{/if}
				</svelte:fragment>
			</Table>
		</div>

		{#each sections as section (section.title)}
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					{#if section.icon}
						<svelte:component
							this={section.icon}
							class="h-4 w-4 text-neutral-600 dark:text-neutral-400"
						/>
					{/if}
					<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
						{section.title}
					</h2>
				</div>
				<Table columns={infoColumns} data={section.rows} responsive>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'label'}
							<span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
								{row.label}
							</span>
						{:else if column.key === 'value'}
							{#if row.type === 'code'}
								<Label variant="secondary" size="md" rounded="md" mono>
									{row.value}
								</Label>
							{:else if row.type === 'link'}
								<Label
									variant="link"
									size="md"
									rounded="md"
									mono
									href={row.href}
									target="_blank"
									rel="noopener noreferrer"
								>
									{row.value}
								</Label>
							{:else}
								<span class="text-sm text-neutral-600 dark:text-neutral-400">{row.value}</span>
							{/if}
						{/if}
					</svelte:fragment>
				</Table>
			</div>
		{/each}

		<!-- Database (special case with custom content) -->
		{#if data.migration.applied.length > 0}
			{@const currentMigration =
				data.migration.applied.find((m) => m.latest) ?? data.migration.applied[0]}
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<Database class="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
					<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Database</h2>
				</div>
				<ExpandableTable
					columns={migrationColumns}
					data={currentMigration ? [currentMigration] : []}
					getRowId={(row) => row.version}
					emptyMessage="No migrations applied"
					responsive
					flushExpanded
					chevronPosition="right"
				>
					<svelte:fragment slot="cell" let:row let:column>
						{#if column.key === 'version'}
							<div class="flex items-center gap-2">
								<Label variant="secondary" size="md" rounded="md" mono>
									v{row.version}
								</Label>
								{#if row.latest}
									<Label
										size="md"
										rounded="md"
										customVariant="bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200"
									>
										Latest
									</Label>
								{/if}
							</div>
						{:else if column.key === 'name'}
							<span class="text-sm text-neutral-600 dark:text-neutral-400">{row.name}</span>
						{:else if column.key === 'applied_at'}
							<span class="text-xs text-neutral-500">
								{new Date(row.applied_at).toLocaleDateString()}
							</span>
						{/if}
					</svelte:fragment>
					<svelte:fragment slot="expanded">
						<div class="p-3">
							<Table columns={migrationColumns} data={data.migration.applied} responsive>
								<svelte:fragment slot="cell" let:row let:column>
									{#if column.key === 'version'}
										<div class="flex items-center gap-2">
											<Label variant="secondary" size="md" rounded="md" mono>
												v{row.version}
											</Label>
											{#if row.latest}
												<Label
													size="md"
													rounded="md"
													customVariant="bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200"
												>
													Latest
												</Label>
											{/if}
										</div>
									{:else if column.key === 'name'}
										<span class="text-sm text-neutral-600 dark:text-neutral-400">{row.name}</span>
									{:else if column.key === 'applied_at'}
										<span class="text-xs text-neutral-500">
											{new Date(row.applied_at).toLocaleDateString()}
										</span>
									{/if}
								</svelte:fragment>
							</Table>
						</div>
					</svelte:fragment>
				</ExpandableTable>
			</div>
		{/if}

		<!-- Releases Section -->
		{#await data.streamed.releasesData}
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<Package class="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
					<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Releases</h2>
				</div>
				<div
					class="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
				>
					<div class="animate-pulse space-y-3">
						<div class="h-8 rounded bg-neutral-200 dark:bg-neutral-800"></div>
						<div class="h-8 rounded bg-neutral-200 dark:bg-neutral-800"></div>
						<div class="h-8 rounded bg-neutral-200 dark:bg-neutral-800"></div>
					</div>
				</div>
			</div>
		{:then releasesData}
			{#if releasesData.releases.length > 0}
				{@const currentRelease = releasesData.releases[0] as ReleaseRow}
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<Package class="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
						<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Releases</h2>
					</div>
					<ExpandableTable
						columns={releaseColumns}
						data={currentRelease ? [currentRelease] : []}
						getRowId={(row) => row.tag_name}
						emptyMessage="No releases found"
						responsive
						flushExpanded
						chevronPosition="right"
					>
						<svelte:fragment slot="cell" let:row let:column let:index>
							{#if column.key === 'tag_name'}
								<div class="flex items-center gap-2">
									<Label
										variant="link"
										size="md"
										rounded="md"
										mono
										href={row.html_url}
										target="_blank"
										rel="noopener noreferrer"
									>
										{row.tag_name}
									</Label>
									{#if index === 0}
										<Label
											size="md"
											rounded="md"
											customVariant="bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200"
										>
											Latest
										</Label>
									{/if}
								</div>
							{:else if column.key === 'published_at'}
								<span class="text-xs text-neutral-500 dark:text-neutral-500">
									{new Date(row.published_at).toLocaleDateString()}
								</span>
							{:else if column.key === 'prerelease'}
								{#if row.prerelease}
									<Label variant="warning" size="md" rounded="md">Pre-release</Label>
								{:else}
									<Label variant="secondary" size="md" rounded="md">Stable</Label>
								{/if}
							{/if}
						</svelte:fragment>
						<svelte:fragment slot="expanded">
							<div class="p-3">
								<Table columns={releaseColumns} data={releasesData.releases} responsive>
									<svelte:fragment slot="cell" let:row let:column let:rowIndex>
										{#if column.key === 'tag_name'}
											<div class="flex items-center gap-2">
												<Label
													variant="link"
													size="md"
													rounded="md"
													mono
													href={row.html_url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{row.tag_name}
												</Label>
												{#if rowIndex === 0}
													<Label
														size="md"
														rounded="md"
														customVariant="bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200"
													>
														Latest
													</Label>
												{/if}
											</div>
										{:else if column.key === 'published_at'}
											<span class="text-xs text-neutral-500 dark:text-neutral-500">
												{new Date(row.published_at).toLocaleDateString()}
											</span>
										{:else if column.key === 'prerelease'}
											{#if row.prerelease}
												<Label variant="warning" size="md" rounded="md">Pre-release</Label>
											{:else}
												<Label variant="secondary" size="md" rounded="md">Stable</Label>
											{/if}
										{/if}
									</svelte:fragment>
								</Table>
							</div>
						</svelte:fragment>
					</ExpandableTable>
				</div>
			{/if}
		{:catch}
			<!-- Silently handle errors - don't show releases section if fetch fails -->
		{/await}
	</div>
</div>
