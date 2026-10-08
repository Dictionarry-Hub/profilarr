/**
 * Renders the Claude review results as one PR comment.
 *
 * Usage: render.ts <results-dir>
 * Reads claude-review-<review>/result.json and meta.json from <results-dir>, plus REPO, HEAD_SHA
 * and RUN_URL from the environment. A missing or invalid result renders as a failed review.
 * To add a review, add it to REVIEWS and to the workflow matrix.
 */

export interface Finding {
	category?: string;
	file: string;
	line: number;
	title: string;
	problem: string;
}

export interface Result {
	status: string;
	findings: Finding[];
}

export interface Meta {
	website_sha?: string;
}

export interface Env {
	repo: string;
	headSha: string;
	runUrl: string;
}

type Outcome = 'Passed' | 'Warning' | 'Failed';

export const MARKER = '<!-- claude-review -->';

/** Each review's form statuses, mapped to the outcome shown in the comment. */
export const REVIEWS: Record<string, { title: string; outcomes: Record<string, Outcome> }> = {
	'user-docs': {
		title: 'User-facing docs',
		outcomes: {
			not_affected: 'Passed',
			up_to_date: 'Passed',
			needs_update: 'Warning',
			could_not_check: 'Warning'
		}
	},
	'technical-docs': {
		title: 'Technical docs',
		outcomes: { not_affected: 'Passed', up_to_date: 'Passed', needs_update: 'Warning' }
	},
	tests: {
		title: 'Tests',
		outcomes: { not_applicable: 'Passed', covered: 'Passed', gaps: 'Warning' }
	},
	code: {
		title: 'Code',
		outcomes: { no_issues: 'Passed', issues: 'Failed' }
	}
};

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

function renderRow(review: string, result: Result | undefined, meta: Meta, env: Env): string {
	const config = REVIEWS[review];
	const outcome = result ? config.outcomes[result.status] : undefined;
	if (!result || !outcome) {
		return `| ${config.title} | Failed | <ul><li>**Review didn't run.** See the [workflow run](${env.runUrl}).</li></ul> |`;
	}

	const blobBase =
		review === 'user-docs'
			? `https://github.com/Dictionarry-Hub/profilarr.com/blob/${meta.website_sha || 'develop'}`
			: `https://github.com/${env.repo}/blob/${env.headSha}`;

	const findings = (result.findings ?? []).slice(0, 5).map((finding) => {
		const category = finding.category ? `${CATEGORIES[finding.category] ?? 'Issue'}: ` : '';
		const title = `**${category}${clean(finding.title).replace(/\.$/, '')}.**`;
		return `<li>${title} ${clean(finding.problem)} ${fileLink(finding, blobBase)}</li>`;
	});

	return `| ${config.title} | ${outcome} | ${findings.length ? `<ul>${findings.join('')}</ul>` : 'N/A'} |`;
}

export function renderComment(
	results: Record<string, Result | undefined>,
	metas: Record<string, Meta | undefined>,
	env: Env
): string {
	return [
		MARKER,
		'| Review | Result | Findings |',
		'| :-- | :-- | :-- |',
		...Object.keys(REVIEWS).map((review) =>
			renderRow(review, results[review], metas[review] ?? {}, env)
		),
		'',
		'<sub>Re-run with <code>@claude review</code></sub>'
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
	const results: Record<string, Result | undefined> = {};
	const metas: Record<string, Meta | undefined> = {};
	for (const review of Object.keys(REVIEWS)) {
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
