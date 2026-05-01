export async function copyToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to the legacy path for non-secure HTTP origins.
		}
	}

	return copyWithTextarea(text);
}

function copyWithTextarea(text: string): boolean {
	if (typeof document === 'undefined' || !document.body) return false;

	const activeElement =
		document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const selection = document.getSelection();
	const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
	const textArea = document.createElement('textarea');

	textArea.value = text;
	textArea.setAttribute('readonly', '');
	textArea.style.position = 'fixed';
	textArea.style.top = '0';
	textArea.style.left = '0';
	textArea.style.width = '1px';
	textArea.style.height = '1px';
	textArea.style.opacity = '0';
	textArea.style.pointerEvents = 'none';

	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();
	textArea.setSelectionRange(0, textArea.value.length);

	let copied = false;
	try {
		copied = document.execCommand('copy');
	} catch {
		copied = false;
	}

	document.body.removeChild(textArea);

	if (selectedRange && selection) {
		selection.removeAllRanges();
		selection.addRange(selectedRange);
	}
	activeElement?.focus();

	return copied;
}
