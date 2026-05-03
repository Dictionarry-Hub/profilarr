import {
	INDEXER_FLAGS,
	LANGUAGES,
	QUALITY_MODIFIERS,
	RELEASE_TYPES,
	RESOLUTIONS,
	SOURCES,
	type SyncArrType
} from '$sync/mappings.ts';
import type {
	DriftDiff,
	DriftDisplayChange,
	DriftDisplayEntity,
	DriftDisplayTone,
	DriftDisplayValue
} from '$shared/drift.ts';

interface CustomFormatDiff {
	missing?: unknown[];
	modified?: unknown[];
}

interface DriftFieldDiff {
	path: string;
	expected: unknown;
	actual: unknown;
}

interface CustomFormatModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface SpecificationValue {
	name: string;
	implementation: string;
	negate: boolean;
	required: boolean;
	fields: { name: string; value: unknown }[];
}

interface ParsedSpecificationPath {
	implementation: string;
	name: string;
	member?: string;
	field?: string;
}

const IMPLEMENTATION_LABELS: Record<string, string> = {
	ReleaseTitleSpecification: 'Release Title',
	ReleaseGroupSpecification: 'Release Group',
	EditionSpecification: 'Edition',
	SourceSpecification: 'Source',
	ResolutionSpecification: 'Resolution',
	IndexerFlagSpecification: 'Indexer Flag',
	QualityModifierSpecification: 'Quality Modifier',
	SizeSpecification: 'Size',
	LanguageSpecification: 'Language',
	ReleaseTypeSpecification: 'Release Type',
	YearSpecification: 'Year'
};

export function buildDriftDisplayEntities(
	diff: DriftDiff,
	arrType: string | undefined
): DriftDisplayEntity[] {
	const syncArrType = arrType === 'radarr' || arrType === 'sonarr' ? arrType : undefined;
	return buildCustomFormatEntities(diff.custom_formats, syncArrType);
}

function buildCustomFormatEntities(
	raw: unknown,
	arrType: SyncArrType | undefined
): DriftDisplayEntity[] {
	const diff = asCustomFormatDiff(raw);
	if (!diff) return [];

	const entities: DriftDisplayEntity[] = [];

	for (const item of diff.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `custom_formats:missing:${name}`,
			section: 'custom_formats',
			sectionLabel: 'Custom Format',
			title: name,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary: 'Profilarr expects this custom format, but Arr does not have it.',
			changes: [
				{
					id: `custom_formats:missing:${name}:format`,
					label: 'Custom format',
					detail: 'Missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			]
		});
	}

	for (const item of diff.modified ?? []) {
		const modified = asModifiedCustomFormat(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map((field, index) =>
			formatCustomFormatFieldDiff(field, index, arrType)
		);

		entities.push({
			id: `custom_formats:modified:${modified.name}`,
			section: 'custom_formats',
			sectionLabel: 'Custom Format',
			title: modified.name,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes
		});
	}

	return entities;
}

function formatCustomFormatFieldDiff(
	field: DriftFieldDiff,
	index: number,
	arrType: SyncArrType | undefined
): DriftDisplayChange {
	if (field.path === 'includeCustomFormatWhenRenaming') {
		return {
			id: `include-in-rename:${index}`,
			label: 'Include in Rename',
			detail: 'Rename behavior changed',
			expected: formatBooleanValue(field.expected),
			actual: formatBooleanValue(field.actual),
			tone: 'warning'
		};
	}

	const specPath = parseSpecificationPath(field.path);
	if (!specPath) {
		return {
			id: `custom-format-field:${index}`,
			label: 'Custom format setting',
			detail: 'Value changed',
			expected: formatGenericValue(field.expected),
			actual: formatGenericValue(field.actual),
			tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
		};
	}

	const label = `${implementationLabel(specPath.implementation)} condition: ${specPath.name}`;

	if (!specPath.member && !specPath.field) {
		return formatSpecificationChange(label, field, arrType, index);
	}

	if (specPath.member === 'negate') {
		return {
			id: `condition-negate:${index}`,
			label,
			detail: 'Match mode changed',
			expected: formatNegateValue(field.expected),
			actual: formatNegateValue(field.actual),
			tone: 'warning'
		};
	}

	if (specPath.member === 'required') {
		return {
			id: `condition-required:${index}`,
			label,
			detail: 'Requirement changed',
			expected: formatRequiredValue(field.expected),
			actual: formatRequiredValue(field.actual),
			tone: 'warning'
		};
	}

	if (specPath.field) {
		return {
			id: `condition-field:${index}`,
			label,
			detail: `${fieldLabel(specPath.implementation, specPath.field)} changed`,
			expected: formatFieldValue(specPath.implementation, specPath.field, field.expected, arrType),
			actual: formatFieldValue(specPath.implementation, specPath.field, field.actual, arrType),
			tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
		};
	}

	return {
		id: `condition-setting:${index}`,
		label,
		detail: 'Condition setting changed',
		expected: formatGenericValue(field.expected),
		actual: formatGenericValue(field.actual),
		tone: 'warning'
	};
}

function formatSpecificationChange(
	label: string,
	field: DriftFieldDiff,
	arrType: SyncArrType | undefined,
	index: number
): DriftDisplayChange {
	if (field.actual === null || field.actual === undefined) {
		return {
			id: `condition-missing:${index}`,
			label,
			detail: 'Condition is missing from Arr',
			expected: formatSpecificationValue(field.expected, arrType),
			actual: value('Missing', { tone: 'danger' }),
			tone: 'danger'
		};
	}

	if (field.expected === null || field.expected === undefined) {
		return {
			id: `condition-extra:${index}`,
			label,
			detail: 'Extra condition exists in Arr',
			expected: value('Not present'),
			actual: formatSpecificationValue(field.actual, arrType),
			tone: 'warning'
		};
	}

	return {
		id: `condition-changed:${index}`,
		label,
		detail: 'Condition changed',
		expected: formatSpecificationValue(field.expected, arrType),
		actual: formatSpecificationValue(field.actual, arrType),
		tone: 'warning'
	};
}

function parseSpecificationPath(path: string): ParsedSpecificationPath | null {
	const match = /^specifications\[([^:\]]+):(.+?)\](?:\.(.+))?$/.exec(path);
	if (!match) return null;

	const tail = match[3];
	const parsed: ParsedSpecificationPath = {
		implementation: match[1],
		name: match[2]
	};

	if (!tail) return parsed;

	const fieldMatch = /^fields\[(.+)\]$/.exec(tail);
	if (fieldMatch) {
		parsed.field = fieldMatch[1];
		return parsed;
	}

	parsed.member = tail;
	return parsed;
}

function asCustomFormatDiff(raw: unknown): CustomFormatDiff | null {
	if (!isRecord(raw)) return null;
	return {
		missing: Array.isArray(raw.missing) ? raw.missing : [],
		modified: Array.isArray(raw.modified) ? raw.modified : []
	};
}

function asModifiedCustomFormat(raw: unknown): CustomFormatModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isFieldDiff);
	return { name, fields };
}

function isFieldDiff(raw: unknown): raw is DriftFieldDiff {
	return (
		isRecord(raw) &&
		typeof raw.path === 'string' &&
		Object.hasOwn(raw, 'expected') &&
		Object.hasOwn(raw, 'actual')
	);
}

function asSpecificationValue(raw: unknown): SpecificationValue | null {
	if (!isRecord(raw)) return null;
	if (typeof raw.name !== 'string' || typeof raw.implementation !== 'string') return null;

	return {
		name: raw.name,
		implementation: raw.implementation,
		negate: Boolean(raw.negate),
		required: Boolean(raw.required),
		fields: Array.isArray(raw.fields)
			? raw.fields.flatMap((field) => {
					if (!isRecord(field) || typeof field.name !== 'string') return [];
					return [{ name: field.name, value: field.value }];
				})
			: []
	};
}

function formatSpecificationValue(
	raw: unknown,
	arrType: SyncArrType | undefined
): DriftDisplayValue {
	const spec = asSpecificationValue(raw);
	if (!spec) return formatGenericValue(raw);

	const fields = spec.fields.map((field) => {
		const formatted = formatFieldValue(spec.implementation, field.name, field.value, arrType);
		return `${fieldLabel(spec.implementation, field.name)}: ${formatted.text}`;
	});
	const modes = [
		spec.required ? 'Required' : 'Optional',
		spec.negate ? 'Must not match' : 'Must match'
	];
	const suffix = [...fields, ...modes].join(', ');

	return value(
		`${implementationLabel(spec.implementation)}: ${spec.name}${suffix ? ` (${suffix})` : ''}`
	);
}

function formatFieldValue(
	implementation: string,
	field: string,
	raw: unknown,
	arrType: SyncArrType | undefined
): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });

	if (field === 'value') {
		if (isPatternImplementation(implementation)) {
			return value(String(raw), { mono: true });
		}
		if (implementation === 'SourceSpecification') {
			return value(mappedName(arrType ? SOURCES[arrType] : undefined, raw) ?? String(raw));
		}
		if (implementation === 'ResolutionSpecification') {
			return value(mappedName(RESOLUTIONS, raw) ?? `${String(raw)}p`);
		}
		if (implementation === 'IndexerFlagSpecification') {
			return value(mappedName(arrType ? INDEXER_FLAGS[arrType] : undefined, raw) ?? String(raw));
		}
		if (implementation === 'QualityModifierSpecification') {
			return value(mappedName(QUALITY_MODIFIERS, raw) ?? String(raw));
		}
		if (implementation === 'ReleaseTypeSpecification') {
			return value(mappedName(RELEASE_TYPES, raw) ?? String(raw));
		}
		if (implementation === 'LanguageSpecification') {
			return value(languageName(arrType, raw) ?? String(raw));
		}
	}

	if (implementation === 'SizeSpecification' && (field === 'min' || field === 'max')) {
		return value(formatBytes(raw));
	}

	if (field === 'exceptLanguage') {
		return formatBooleanValue(raw);
	}

	return formatGenericValue(raw);
}

function formatGenericValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw === 'boolean') return formatBooleanValue(raw);
	if (typeof raw === 'string') return value(raw, { mono: looksTechnical(raw) });
	if (typeof raw === 'number') return value(String(raw), { mono: true });
	if (Array.isArray(raw)) return value(raw.map((item) => formatGenericValue(item).text).join(', '));

	const spec = asSpecificationValue(raw);
	if (spec) return formatSpecificationValue(spec, undefined);

	return value('Structured value');
}

function formatBooleanValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	return value(raw ? 'Enabled' : 'Disabled', {
		tone: raw ? 'success' : 'neutral'
	});
}

function formatNegateValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	return value(raw ? 'Must not match' : 'Must match');
}

function formatRequiredValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	return value(raw ? 'Required' : 'Optional');
}

function fieldLabel(implementation: string, field: string): string {
	if (field === 'value') {
		if (isPatternImplementation(implementation)) return 'Pattern';
		if (implementation === 'LanguageSpecification') return 'Language';
		return implementationLabel(implementation);
	}
	if (field === 'min') return 'Minimum';
	if (field === 'max') return 'Maximum';
	if (field === 'exceptLanguage') return 'Except Language';
	return titleize(field);
}

function implementationLabel(implementation: string): string {
	return (
		IMPLEMENTATION_LABELS[implementation] ?? titleize(implementation.replace(/Specification$/, ''))
	);
}

function isPatternImplementation(implementation: string): boolean {
	return (
		implementation === 'ReleaseTitleSpecification' ||
		implementation === 'ReleaseGroupSpecification' ||
		implementation === 'EditionSpecification'
	);
}

function mappedName(map: Record<string, number> | undefined, raw: unknown): string | null {
	if (typeof raw !== 'number' || !map) return null;
	for (const [key, value] of Object.entries(map)) {
		if (value === raw) return titleizeMappingKey(key);
	}
	return null;
}

function languageName(arrType: SyncArrType | undefined, raw: unknown): string | null {
	if (typeof raw !== 'number' || !arrType) return null;
	for (const language of Object.values(LANGUAGES[arrType])) {
		if (language.id === raw) return language.name;
	}
	return null;
}

function formatBytes(raw: unknown): string {
	if (typeof raw !== 'number' || raw <= 0) return 'None';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = raw;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value = value / 1024;
		unitIndex++;
	}
	const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
	return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function titleize(value: string): string {
	return value
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function titleizeMappingKey(value: string): string {
	const label = titleize(value);
	return label
		.replace(/\bTv\b/g, 'TV')
		.replace(/\bDl\b/g, 'DL')
		.replace(/\bHd\b/g, 'HD')
		.replace(/\bRawhd\b/g, 'Raw HD')
		.replace(/\bBrdisk\b/g, 'BR Disk');
}

function looksTechnical(value: string): boolean {
	return /[\\^$.[\]()*+?{}|]/.test(value);
}

function value(
	text: string,
	options: { mono?: boolean; tone?: DriftDisplayTone } = {}
): DriftDisplayValue {
	return {
		text,
		mono: options.mono,
		tone: options.tone
	};
}

function recordString(raw: unknown, key: string): string | null {
	if (!isRecord(raw)) return null;
	const value = raw[key];
	return typeof value === 'string' ? value : null;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
	return typeof raw === 'object' && raw !== null;
}
