"""
Audit script to find all usages of get_active_academic_year() that need to be migrated.
"""
import os
import re
import sys
from pathlib import Path

# Force UTF-8 output for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Find all Python files in routers directory
routers_dir = Path(__file__).parent / 'routers'
results = []

for py_file in routers_dir.glob('*.py'):
    with open(py_file, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    # Find all occurrences of get_active_academic_year
    for line_num, line in enumerate(lines, 1):
        if 'get_active_academic_year' in line and 'from core import' not in line:
            # Get context (5 lines before and after)
            start = max(0, line_num - 6)
            end = min(len(lines), line_num + 5)
            context_lines = lines[start:end]

            # Find function name
            func_name = None
            for i in range(line_num - 1, max(0, line_num - 50), -1):
                if lines[i].strip().startswith(('async def ', 'def ')):
                    match = re.search(r'def\s+(\w+)', lines[i])
                    if match:
                        func_name = match.group(1)
                    break

            # Find endpoint decorator
            endpoint = None
            for i in range(line_num - 1, max(0, line_num - 10), -1):
                if '@router.' in lines[i]:
                    endpoint = lines[i].strip()
                    break

            results.append({
                'file': py_file.name,
                'line': line_num,
                'function': func_name,
                'endpoint': endpoint,
                'code': line.strip(),
                'context': '\n'.join(f"{start+i+1:4}: {l}" for i, l in enumerate(context_lines))
            })

print("=" * 80)
print("AUDIT: get_active_academic_year() Usage")
print("=" * 80)
print(f"\nFound {len(results)} occurrences that may need migration\n")

for r in results:
    print(f"📄 {r['file']}:{r['line']}")
    if r['endpoint']:
        print(f"   Endpoint: {r['endpoint']}")
    if r['function']:
        print(f"   Function: {r['function']}()")
    print(f"   Code: {r['code']}")
    print(f"\n   Context:")
    print(f"   {r['context']}")
    print("\n" + "-" * 80 + "\n")

print("\n" + "=" * 80)
print(f"TOTAL: {len(results)} usages found")
print("=" * 80)
