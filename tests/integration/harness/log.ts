/**
 * Color-coded logger for integration tests.
 * Each source (server, client, setup) gets its own color.
 */

const c = {
	reset: '\x1b[0m',
	grey: '\x1b[90m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	red: '\x1b[31m',
	magenta: '\x1b[35m',
	bold: '\x1b[1m'
};

function timestamp(): string {
	const now = new Date();
	const h = String(now.getHours()).padStart(2, '0');
	const m = String(now.getMinutes()).padStart(2, '0');
	const s = String(now.getSeconds()).padStart(2, '0');
	return `${c.grey}${h}:${m}:${s}${c.reset}`;
}

function tag(label: string, color: string): string {
	return `${color}${label.padEnd(7)}${c.reset}`;
}

function statusColor(status: number): string {
	if (status < 300) return c.green;
	if (status < 400) return c.yellow;
	return c.red;
}

export const log = {
	server(port: number, msg: string) {
		console.log(`${timestamp()} | ${tag('server', c.cyan)} | ${c.grey}:${port}${c.reset} | ${msg}`);
	},

	request(method: string, path: string, status: number, detail?: string) {
		const sc = statusColor(status);
		const extra = detail ? ` | ${detail}` : '';
		console.log(
			`${timestamp()} | ${tag('client', c.green)} | ${c.bold}${method}${c.reset} ${path} → ${sc}${status}${c.reset}${extra}`
		);
	},

	setup(msg: string) {
		console.log(`${timestamp()} | ${tag('setup', c.magenta)} | ${msg}`);
	}
};
