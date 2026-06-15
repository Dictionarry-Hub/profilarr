import { assertEquals } from '@std/assert';
import { evaluateCustomFormat } from '$pcd/entities/customFormats/evaluator.ts';
import { Language, QualitySource, QualityModifier, Resolution } from '$lib/server/utils/arr/parser/types.ts';
import type { ParseResult } from '$lib/server/utils/arr/parser/types.ts';
import type { ConditionData } from '$shared/pcd/display.ts';

function parsed(languages: Language[]): ParseResult {
	return {
		title: 'Test',
		type: 'movie',
		source: QualitySource.WebDL,
		resolution: Resolution.R1080p,
		modifier: QualityModifier.None,
		revision: { version: 1, real: 0, isRepack: false },
		languages,
		releaseGroup: null,
		movieTitles: [],
		year: 2026,
		edition: null,
		imdbId: null,
		tmdbId: 0,
		hardcodedSubs: null,
		releaseHash: null,
		episode: null
	};
}

function langCondition(name: string): ConditionData {
	return {
		name,
		type: 'language',
		arrType: 'all',
		negate: false,
		required: false,
		languages: [{ name, except: false }]
	};
}

// Regression: language names with spaces/parens (e.g. "Spanish (Latino)") were
// looked up via enum key access which always returned undefined, causing the
// condition to silently skip and never match.
Deno.test('evaluateCustomFormat: Spanish (Latino) matches when release language is SpanishLatino', () => {
	const result = evaluateCustomFormat(
		[langCondition('Spanish (Latino)')],
		parsed([Language.SpanishLatino]),
		'The.Punisher.One.Last.Kill.2026.WEBDL.Latino.TTR.mkv',
		null
	);

	assertEquals(result.matches, true);
});

Deno.test('evaluateCustomFormat: Spanish matches when release language is Spanish', () => {
	const result = evaluateCustomFormat(
		[langCondition('Spanish')],
		parsed([Language.Spanish]),
		'The.Punisher.One.Last.Kill.2026.WEBDL.Castellano.TTR.mkv',
		null
	);

	assertEquals(result.matches, true);
});

Deno.test('evaluateCustomFormat: Spanish (Latino) does not match when release language is only Spanish', () => {
	const result = evaluateCustomFormat(
		[langCondition('Spanish (Latino)')],
		parsed([Language.Spanish]),
		'The.Punisher.One.Last.Kill.2026.WEBDL.Castellano.TTR.mkv',
		null
	);

	assertEquals(result.matches, false);
});
