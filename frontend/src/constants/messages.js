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
    'No changes found. The regex gods nod in approval.',
    'Your repo is so calm, it might as well be meditating.',
    'Nothing to sync. It’s as if time stood still.',
    'All quiet on the version control front. Too quiet…',
    'Zero changes detected. A true masterpiece in stasis.',
    'No updates needed. Your repo just passed the vibe check.',
    'Your repository is the epitome of order. No changes here.',
    'The sync fairy confirms: no updates required.',
    'Everything’s stable. Your repo deserves a standing ovation.'
];

export const getRandomMessage = messages => {
    return messages[Math.floor(Math.random() * messages.length)];
};
