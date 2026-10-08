/**
 * Renders the four Claude review results as one PR comment.
 *
 * Usage: render.ts <results-dir>
 * Reads claude-review-<review>/result.json and meta.json from <results-dir>, plus REPO, HEAD_SHA
 * and RUN_URL from the environment. A missing or invalid result renders as a failed review.
 */

type Review = 'user-docs' | 'technical-docs' | 'tests' | 'code';

interface Finding {
	category?: string;
	file: string;
	line: number;
	title: string;
	problem: string;
}

interface Result {
	status: string;
	findings: Finding[];
	covered_by?: string[];
}

interface Meta {
	website_sha?: string;
	website_label?: string;
}

export interface Env {
	repo: string;
	headSha: string;
	runUrl: string;
}

export const MARKER = '<!-- claude-review -->';

const REVIEWS: Record<Review, { title: string; statuses: Record<string, string> }> = {
	'user-docs': {
		title: 'User-facing docs',
		statuses: {
			not_affected: '➖ Not affected',
			up_to_date: '✅ Up to date',
			needs_update: '⚠️ Needs update',
			could_not_check: "❔ Couldn't check"
		}
	},
	'technical-docs': {
		title: 'Technical docs',
		statuses: {
			not_affected: '➖ Not affected',
			up_to_date: '✅ Up to date',
			needs_update: '⚠️ Needs update'
		}
	},
	tests: {
		title: 'Tests',
		statuses: {
			not_applicable: '➖ Not applicable',
			covered: '✅ Covered',
			gaps: '⚠️ Gaps'
		}
	},
	code: {
		title: 'Code',
		statuses: {
			no_issues: '✅ No issues',
			issues: '⚠️ Issues'
		}
	}
};

const ORDER: Review[] = ['user-docs', 'technical-docs', 'tests', 'code'];

const CATEGORIES: Record<string, string> = {
	bug: 'Bug',
	data_loss: 'Data loss',
	security: 'Security',
	breaking_change: 'Breaking change'
};

/** Model text is untrusted: keep it on one line, and stop it adding HTML, table cells or @mentions. */
function clean(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\|/g, '\\|')
		.replace(/@/g, '@​')
		.trim();
}

function fileLink(finding: Finding, blobBase: string): string {
	const path = finding.file.replace(/^(pr-head|website)\//, '').replace(/^\/+/, '');
	// Encode parentheses too, so paths like src/routes/(docs)/ don't end the Markdown link early.
	const encoded = encodeURI(path).replace(/\(/g, '%28').replace(/\)/g, '%29');
	const name = path.split('/').pop() ?? path;
	const tooltip = clean(path).replace(/"/g, '');
	return `[${clean(name)}#L${finding.line}](${blobBase}/${encoded}#L${finding.line} "${tooltip}")`;
}

function renderRow(review: Review, result: Result | undefined, meta: Meta, env: Env): string {
	const config = REVIEWS[review];
	const status = result ? config.statuses[result.status] : undefined;
	if (!result || !status) {
		return `| ${config.title} | ❔ Failed | [Workflow run](${env.runUrl}) |`;
	}

	const findings = (result.findings ?? []).slice(0, 5);
	const label =
		review === 'code' && findings.length
			? `⚠️ ${findings.length} issue${findings.length === 1 ? '' : 's'}`
			: status;

	const blobBase =
		review === 'user-docs'
			? `https://github.com/Dictionarry-Hub/profilarr.com/blob/${meta.website_sha || 'develop'}`
			: `https://github.com/${env.repo}/blob/${env.headSha}`;

	let details = '—';
	if (findings.length) {
		const items = findings.map((finding) => {
			const category = finding.category ? `${CATEGORIES[finding.category] ?? 'Issue'}: ` : '';
			const title = `**${category}${clean(finding.title).replace(/\.$/, '')}.**`;
			return `<li>${title} ${clean(finding.problem)} ${fileLink(finding, blobBase)}</li>`;
		});
		details = `<ul>${items.join('')}</ul>`;
	} else if (review === 'tests' && result.covered_by?.length) {
		const tests = result.covered_by
			.slice(0, 10)
			.map((file) => `\`${clean(file.split('/').pop() ?? file)}\``);
		details = `Covered by ${tests.join(', ')}`;
	}

	return `| ${config.title} | ${label} | ${details} |`;
}

export function renderComment(
	results: Partial<Record<Review, Result>>,
	metas: Partial<Record<Review, Meta>>,
	env: Env
): string {
	const website = metas['user-docs']?.website_label;
	const footer = [
		'🤖 Docs and tests: Sonnet 5.5',
		'Code: Opus 5.5',
		`reviewed <code>${env.headSha.slice(0, 7)}</code>`,
		...(website ? [website] : []),
		're-run with <code>@claude review</code>'
	].join(' · ');

	return [
		MARKER,
		'### Claude review',
		'',
		'---',
		'',
		'| Review | Result | Findings |',
		'| :-- | :-- | :-- |',
		...ORDER.map((review) => renderRow(review, results[review], metas[review] ?? {}, env)),
		'',
		'---',
		'',
		`<sub>${footer}</sub>`
	].join('\n');
}

function readJson<T>(path: string): T | undefined {
	try {
		return JSON.parse(Deno.readTextFileSync(path)) as T;
	} catch {
		return undefined;
	}
}

if (import.meta.main) {
	const [dir] = Deno.args;
	if (!dir) {
		console.error('Usage: render.ts <results-dir>');
		Deno.exit(1);
	}
	const results: Partial<Record<Review, Result>> = {};
	const metas: Partial<Record<Review, Meta>> = {};
	for (const review of ORDER) {
		results[review] = readJson<Result>(`${dir}/claude-review-${review}/result.json`);
		metas[review] = readJson<Meta>(`${dir}/claude-review-${review}/meta.json`);
	}
	console.log(
		renderComment(results, metas, {
			repo: Deno.env.get('REPO') ?? '',
			headSha: Deno.env.get('HEAD_SHA') ?? '',
			runUrl: Deno.env.get('RUN_URL') ?? ''
		})
	);
}
