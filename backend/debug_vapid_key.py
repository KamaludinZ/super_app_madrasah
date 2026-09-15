import os
from dotenv import load_dotenv

load_dotenv()

raw_key = os.getenv('VAPID_PRIVATE_KEY', '')

print('Raw key first 100 chars:')
print(raw_key[:100])
print()

print('Repr of first 100 chars:')
print(repr(raw_key[:100]))
print()

# Check position 25-27 (should be the first newline position)
print('Characters at position 25-27:')
print('  repr:', repr(raw_key[25:27]))
print('  is \\n (actual newline)?', raw_key[25:27] == '\n')
print('  is "\\n" (backslash-n)?', raw_key[25] == '\\' and raw_key[26] == 'n')
print()

# Try the current replacement
current_method = raw_key.replace("\\n", "\n")
print('After replace("\\\\n", "\\n"):')
print('  First 100:', current_method[:100])
print()

# Try alternative replacement
if '\\n' not in raw_key:
    print('Key does NOT contain literal \\\\n (backslash-backslash-n)')
    print('Trying to check if dotenv already converted it...')

    # Check if key already has real newlines
    if '\n' in raw_key:
        print('Key ALREADY has real newlines!')
        fixed_key = raw_key
    else:
        print('Key has NO newlines at all - this is the problem!')
        # Need to handle the case where .env stores it with literal \n
        print('This means .env has literal backslash-n that dotenv sees as two chars')
else:
    print('Key contains \\\\n, current code should work')
    fixed_key = raw_key.replace("\\n", "\n")

print()
print('First 3 lines of key after fix:')
lines = fixed_key.split('\n') if '\n' in fixed_key else [fixed_key]
for i, line in enumerate(lines[:3]):
    print(f'  Line {i+1}: {line}')
