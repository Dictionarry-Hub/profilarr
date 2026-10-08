/**
 * Renders one Claude review result as a PR comment.
 *
 * Usage: render.ts <review> <result-dir>
 * Reads result.json and meta.json from <result-dir>, plus REPO, HEAD_SHA and RUN_URL from the
 * environment. A missing or invalid result renders as a failed review.
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

const REVIEWS: Record<Review, { title: string; model: string; statuses: Record<string, string> }> =
	{
		'user-docs': {
			title: 'User-facing docs',
			model: 'Sonnet 5.5',
			statuses: {
				not_affected: '➖ Not affected',
				up_to_date: '✅ Up to date',
				needs_update: '⚠️ Needs update',
				could_not_check: "❔ Couldn't check"
			}
		},
		'technical-docs': {
			title: 'Technical docs',
			model: 'Sonnet 5.5',
			statuses: {
				not_affected: '➖ Not affected',
				up_to_date: '✅ Up to date',
				needs_update: '⚠️ Needs update'
			}
		},
		tests: {
			title: 'Tests',
			model: 'Sonnet 5.5',
			statuses: {
				not_applicable: '➖ Not applicable',
				covered: '✅ Covered',
				gaps: '⚠️ Gaps'
			}
		},
		code: {
			title: 'Code',
			model: 'Opus 5.5',
			statuses: {
				no_issues: '✅ No issues',
				issues: '⚠️ Issues'
			}
		}
	};

const CATEGORIES: Record<string, string> = {
	bug: 'Bug',
	data_loss: 'Data loss',
	security: 'Security',
	breaking_change: 'Breaking change'
};

/** Model text is untrusted: keep it on one line, and stop it adding HTML or @mentions. */
function clean(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/@/g, '@​')
		.trim();
}

function fileLink(finding: Finding, blobBase: string): string {
	const path = finding.file.replace(/^(pr-head|website)\//, '').replace(/^\/+/, '');
	// Encode parentheses too, so paths like src/routes/(docs)/ don't end the Markdown link early.
	const encoded = encodeURI(path).replace(/\(/g, '%28').replace(/\)/g, '%29');
	const url = `${blobBase}/${encoded}#L${finding.line}`;
	return `[\`${clean(path)}#L${finding.line}\`](${url})`;
}

function readJson<T>(path: string): T | undefined {
	try {
		return JSON.parse(Deno.readTextFileSync(path)) as T;
	} catch {
		return undefined;
	}
}

export function renderReview(
	review: Review,
	result: Result | undefined,
	meta: Meta,
	env: { repo: string; headSha: string; runUrl: string }
): string {
	const config = REVIEWS[review];
	const marker = `<!-- claude-review:${review} -->`;
	const websiteNote =
		review === 'user-docs' && meta.website_label ? ` · ${meta.website_label}` : '';
	const footer = `<sub>🤖 ${config.model} · reviewed <code>${env.headSha.slice(0, 7)}</code>${websiteNote} · re-run with <code>@claude review</code></sub>`;

	const status = result ? config.statuses[result.status] : undefined;
	if (!result || !status) {
		return [
			marker,
			`### ${config.title}: ❔ Review failed`,
			'',
			`No result. See the [workflow run](${env.runUrl}).`,
			'',
			footer
		].join('\n');
	}

	const findings = (result.findings ?? []).slice(0, 5);
	const heading =
		review === 'code' && findings.length
			? `⚠️ ${findings.length} issue${findings.length === 1 ? '' : 's'}`
			: status;

	const blobBase =
		review === 'user-docs'
			? `https://github.com/Dictionarry-Hub/profilarr.com/blob/${meta.website_sha ?? 'develop'}`
			: `https://github.com/${env.repo}/blob/${env.headSha}`;

	const lines = [marker, `### ${config.title}: ${heading}`, ''];
	for (const finding of findings) {
		const category = finding.category ? `${CATEGORIES[finding.category] ?? ''} · ` : '';
		lines.push(
			`- **${category}${clean(finding.title)}:** ${clean(finding.problem)} ${fileLink(finding, blobBase)}`
		);
	}
	if (review === 'tests' && result.covered_by?.length) {
		const tests = result.covered_by.slice(0, 10).map((file) => `\`${clean(file)}\``);
		lines.push(`Covered by ${tests.join(', ')}`);
	}
	if (lines.length > 3) lines.push('');
	lines.push(footer);
	return lines.join('\n');
}

if (import.meta.main) {
	const [review, dir] = Deno.args;
	if (!(review in REVIEWS) || !dir) {
		console.error('Usage: render.ts <review> <result-dir>');
		Deno.exit(1);
	}
	const result = readJson<Result>(`${dir}/result.json`);
	const meta = readJson<Meta>(`${dir}/meta.json`) ?? {};
	console.log(
		renderReview(review as Review, result, meta, {
			repo: Deno.env.get('REPO') ?? '',
			headSha: Deno.env.get('HEAD_SHA') ?? '',
			runUrl: Deno.env.get('RUN_URL') ?? ''
		})
	);
}
