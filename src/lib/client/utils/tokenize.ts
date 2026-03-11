export type Token = { type: string; text: string };

const SQL_KEYWORDS = new Set([
	'INSERT',
	'INTO',
	'UPDATE',
	'DELETE',
	'SET',
	'WHERE',
	'FROM',
	'AND',
	'OR',
	'NOT',
	'IN',
	'VALUES',
	'SELECT',
	'CREATE',
	'ALTER',
	'DROP',
	'TABLE',
	'INDEX',
	'ON',
	'AS',
	'IS',
	'NULL',
	'DEFAULT',
	'PRIMARY',
	'KEY',
	'FOREIGN',
	'REFERENCES',
	'CASCADE',
	'EXISTS',
	'IF',
	'BEGIN',
	'COMMIT',
	'REPLACE',
	'GROUP',
	'BY',
	'ORDER',
	'LIMIT',
	'HAVING',
	'JOIN',
	'LEFT',
	'RIGHT',
	'INNER',
	'LIKE',
	'BETWEEN',
	'DISTINCT',
	'UNION',
	'ALL',
	'CASE',
	'WHEN',
	'THEN',
	'ELSE',
	'END',
	'ASC',
	'DESC',
	'OFFSET',
	'ROLLBACK',
	'WITH'
]);

// Patterns tried in priority order
const SQL_PATTERNS: [RegExp, string][] = [
	[/^--[^\n]*/, 'comment'],
	[/^'(?:[^']|'')*'/, 'string'],
	[/^\d+(?:\.\d+)?/, 'number'],
	[/^[a-zA-Z_]\w*/, 'word'],
	[/^(?:<>|!=|<=|>=|\|\||[=<>])/, 'operator'],
	[/^[(),;.]/, 'punctuation'],
	[/^\s+/, 'whitespace']
];

const JSON_PATTERNS: [RegExp, string][] = [
	[/^"(?:[^"\\]|\\.)*"\s*(?=:)/, 'key'],
	[/^"(?:[^"\\]|\\.)*"/, 'string'],
	[/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
	[/^(?:true|false|null)\b/, 'literal'],
	[/^[{}[\]:,]/, 'punctuation'],
	[/^\s+/, 'whitespace']
];

function scan(code: string, patterns: [RegExp, string][]): Token[] {
	const tokens: Token[] = [];
	let pos = 0;

	while (pos < code.length) {
		let matched = false;
		const slice = code.slice(pos);

		for (const [regex, type] of patterns) {
			const match = regex.exec(slice);
			if (match) {
				tokens.push({ type, text: match[0] });
				pos += match[0].length;
				matched = true;
				break;
			}
		}

		if (!matched) {
			tokens.push({ type: 'text', text: code[pos] });
			pos += 1;
		}
	}

	return tokens;
}

export function tokenizeSql(code: string): Token[] {
	const raw = scan(code, SQL_PATTERNS);
	return raw.map((token) => {
		if (token.type === 'word') {
			return {
				type: SQL_KEYWORDS.has(token.text.toUpperCase()) ? 'keyword' : 'identifier',
				text: token.text
			};
		}
		return token;
	});
}

export function tokenizeJson(code: string): Token[] {
	return scan(code, JSON_PATTERNS);
}

export function tokenize(code: string, language: string): Token[] {
	if (!code) return [];
	switch (language) {
		case 'sql':
			return tokenizeSql(code);
		case 'json':
			return tokenizeJson(code);
		default:
			return [{ type: 'text', text: code }];
	}
}
