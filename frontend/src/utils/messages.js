// messages.js

export const statusLoadingMessages = [
    "Checking for changes... don't blink!",
    'Syncing with the mothership...',
    'Peeking under the hood...',
    'Counting bits and bytes...',
    'Scanning for modifications...',
    'Looking for new stuff...',
    'Comparing local and remote...',
    "Checking your project's pulse...",
    "Analyzing your code's mood...",
    "Reading the project's diary..."
];

export const noChangesMessages = [
    'No changes detected. Your regex is so precise, it could find a needle in a haystack... made of needles. 🧵🔍',
    'All quiet on the commit front. Your custom formats are so perfect, even perfectionists are jealous. 🏆',
    "No updates needed. Your media automation is running so smoothly, it's making butter jealous. 🧈",
    'Zero modifications. Your torrent setup is seeding so efficiently, farmers are asking for advice. 🌾',
    "No edits required. Your regex fu is so strong, it's bench-pressing parentheses for fun. 💪()",
    'Unchanged status. Your Plex library is so well-organized, librarians are taking notes. 📚🤓',
    "No alterations found. Your file naming scheme is so consistent, it's bringing tears to OCD eyes. 😢👀",
    "All systems nominal. Your download queue is so orderly, it's making Marie Kondo question her career. 🧹✨",
    "No revisions necessary. Your automation scripts are so smart, they're solving captchas for fun. 🤖🧩",
    'Steady as she goes. Your media collection is so complete, Netflix is asking you for recommendations. 🎬👑'
];

export const getRandomMessage = (messages) => {
    return messages[Math.floor(Math.random() * messages.length)];
};
