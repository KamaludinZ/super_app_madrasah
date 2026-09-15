const formatToken = (value) => {
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleanValue.length === 0) return '';

    let formatted = '';

    // Part 1: Class name (2-3 characters: 7A, 8B, 10A, etc.)
    // Valid patterns:
    //   - digit + letter (7A, 8B, 9C)
    //   - 2 digits + letter (10A, 11B, 12C)
    // Part 2: Year (4 consecutive digits starting with 2: 2026, 2526)

    // Try matching pattern: (digit+letter OR 2digits+letter) followed by (year starting with 2)
    let yearMatch = cleanValue.match(/^(\d[A-Z])(\d{4})/);  // Pattern: 7A2026

    if (!yearMatch) {
        // Try 3-char class name pattern: 10A2026
        yearMatch = cleanValue.match(/^(\d{2}[A-Z])(\d{4})/);
    }

    if (yearMatch) {
        // Found valid class name + year pattern
        const classNameEnd = yearMatch[1].length;
        const part1 = yearMatch[1];
        formatted += part1;

        // Part 2: Year (must be 4 digits)
        const part2 = yearMatch[2];
        formatted += '-' + part2;

        // Part 3: Random code (4 characters after year)
        if (cleanValue.length > classNameEnd + 4) {
            const part3 = cleanValue.slice(classNameEnd + 4, classNameEnd + 8);
            formatted += '-' + part3;
        }
    } else {
        // No valid year pattern found yet, just show what user typed
        // Detect potential class name (default 2 chars, 3 if pattern matches)
        let classNameEnd = 2;

        // If starts with 2 digits followed by letter, use 3 chars
        if (cleanValue.match(/^\d{2}[A-Z]/)) {
            classNameEnd = 3;
        }

        const part1 = cleanValue.slice(0, classNameEnd);
        formatted += part1;

        if (cleanValue.length > classNameEnd) {
            const rest = cleanValue.slice(classNameEnd);
            formatted += '-' + rest;
        }
    }

    return formatted;
};

// Test cases
const tests = [
    // Valid tokens
    { input: '7a25265uvz', expected: '7A-2526-5UVZ', valid: true },
    { input: '7A-2526-5UVZ', expected: '7A-2526-5UVZ', valid: true },
    { input: '7a2026ah5q', expected: '7A-2026-AH5Q', valid: true },
    { input: '8b2026bay8', expected: '8B-2026-BAY8', valid: true },
    { input: '10a20265xyz', expected: '10A-2026-5XYZ', valid: true },
    { input: '9c2026qfrb', expected: '9C-2026-QFRB', valid: true },

    // Invalid tokens (no 4 digits for year)
    { input: 'qweqweqweqw', expected: 'QW-EQWEQWEQW', valid: false, note: 'No year digits - akan di-reject backend' },
    { input: 'abc123def', expected: 'AB-C123DEF', valid: false, note: 'Only 3 digits, bukan 4' },

    // Partial input (masih mengetik)
    { input: '7a', expected: '7A', valid: false, note: 'Belum lengkap' },
    { input: '7a2', expected: '7A-2', valid: false, note: 'Belum lengkap' },
    { input: '7a202', expected: '7A-202', valid: false, note: 'Belum lengkap' },
    { input: '7a2026', expected: '7A-2026', valid: false, note: 'Belum lengkap (kode kurang)' },
];

console.log('=== Token Format Tests ===\n');

let validTests = 0;
let invalidTests = 0;

tests.forEach((test, i) => {
    const result = formatToken(test.input);
    const pass = result === test.expected;

    if (test.valid) validTests++;
    else invalidTests++;

    console.log(`Test ${i + 1}: ${pass ? '✅ PASS' : '❌ FAIL'} ${test.valid ? '[VALID TOKEN]' : '[INVALID/PARTIAL]'}`);
    console.log(`  Input:    "${test.input}"`);
    console.log(`  Expected: "${test.expected}"`);
    console.log(`  Got:      "${result}"`);
    if (test.note) {
        console.log(`  Note:     ${test.note}`);
    }
    console.log('');
});

console.log(`\nSummary: ${validTests} valid tokens, ${invalidTests} invalid/partial inputs tested`);
console.log('\nIMPORTANT: Backend validation akan reject token tanpa 4 digit tahun yang valid!');
