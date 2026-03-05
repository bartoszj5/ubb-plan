
// Mock parsing logic from server/index.js
function parseICSDate(dateStr) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(9, 11);
    const minute = dateStr.substring(11, 13);
    const second = dateStr.substring(13, 15);

    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

// Test cases
const cases = [
    "20251020T080000",   // Floating 8:00
    "20251020T080000Z",  // UTC 8:00
    "20251020T080000",   // With different hour
];

console.log("Testing parseICSDate:");
cases.forEach(c => {
    const res = parseICSDate(c);
    console.log(`Input: ${c} -> Output: ${res}`);

    // Simulate frontend parsing
    const date = new Date(res);
    console.log(`  Frontend new Date('${res}'):`);
    console.log(`    getUTCHours(): ${date.getUTCHours()}`);
    console.log(`    getHours() (Local): ${date.getHours()}`);
});
