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
    'All synced up! Smooth sailing ahead.',
    "No changes detected. We're all good here.",
    "Everything's in order. Carry on!",
    'Up to date and ready to go.',
    'All quiet on the regex front!',
    'Perfectly synced! Nice work.',
    "No updates needed. You're all set.",
    "Everything's hunky-dory in your repository.",
    'All good in the code neighborhood.',
    'Sync complete! Ship-Shape.'
];

export const getRandomMessage = messages => {
    return messages[Math.floor(Math.random() * messages.length)];
};
