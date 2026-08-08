import type {
	CustomFormatTableRow,
	QualityProfileTableRow,
	RegularExpressionWithTags
} from '$shared/pcd/display.ts';

function nonEmpty(values: Array<string | null | undefined>): string[] {
	return values.filter((value): value is string => Boolean(value));
}

export function customFormatSearchValues(item: CustomFormatTableRow): string[] {
	return nonEmpty([
		item.name,
		...item.tags.map((tag) => tag.name),
		item.description,
		...item.conditions.map((condition) => condition.name)
	]);
}

export function qualityProfileLanguageLabel(item: QualityProfileTableRow): string {
	if (!item.language || item.language.name === 'Original') return 'Any';
	return item.language.name;
}

export function qualityProfileSearchValues(item: QualityProfileTableRow): string[] {
	return nonEmpty([
		item.name,
		...item.tags.map((tag) => tag.name),
		item.description,
		qualityProfileLanguageLabel(item),
		...item.qualities.map((quality) => quality.name)
	]);
}

export function regularExpressionSearchValues(item: RegularExpressionWithTags): string[] {
	return nonEmpty([
		item.name,
		...item.tags.map((tag) => tag.name),
		item.pattern,
		item.description,
		item.regex101_id
	]);
}
