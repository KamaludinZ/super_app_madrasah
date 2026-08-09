#!/usr/bin/env python3
"""
Security Audit & Fix Script
Menghapus console.log dan debug statements untuk production
"""

import os
import re
import glob
from pathlib import Path

# Direktori yang akan di-scan
FRONTEND_SRC = "frontend/src"
BACKEND_DIR = "backend"

# File yang akan di-ignore (test files, dev scripts)
IGNORE_PATTERNS = [
    "**/test_*.py",
    "**/seed_*.py",
    "**/*_test.py",
    "**/migrations/**",
    "**/check_*.py",
    "**/verify_*.py",
    "**/poc_*.py",
    "**/iterasi*.py",
    "**/backend_test*.py",
]

def should_ignore(filepath):
    """Check if file should be ignored"""
    for pattern in IGNORE_PATTERNS:
        if Path(filepath).match(pattern):
            return True
    return False

def remove_console_logs_from_file(filepath):
    """Remove console.log statements from JS/JSX files"""
    if should_ignore(filepath):
        return 0

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Pola untuk mendeteksi console.log yang perlu dihapus
        # Kecuali yang ada komentar // KEEP atau /* KEEP */
        patterns_to_remove = [
            # Single line console.log
            r'^\s*console\.(log|debug|info|table|dir)\([^)]*\);?\s*$',
            # Multi-line console.log
            r'^\s*console\.(log|debug|info|table|dir)\([^)]*\n[^)]*\);?\s*$',
        ]

        lines = content.split('\n')
        new_lines = []
        skip_next = False

        for i, line in enumerate(lines):
            # Check if line has KEEP comment
            if '// KEEP' in line or '/* KEEP' in line or '// @security-keep' in line:
                new_lines.append(line)
                continue

            # Check if it's a console statement
            is_console = re.search(r'console\.(log|debug|info|warn|error|table|dir)', line)

            if is_console and not skip_next:
                # Check if it's part of the visibility debug (we want to keep this one)
                if '[Visibility]' in line or 'Visibility' in line:
                    new_lines.append(line)
                    continue

                # Check if line is complete or spans multiple lines
                if line.strip().endswith(');') or line.strip().endswith(')'):
                    # Complete statement - remove it
                    continue
                else:
                    # Multi-line statement - skip this and next lines until we find closing
                    skip_next = True
                    continue
            elif skip_next:
                # We're in a multi-line console statement
                if ');' in line or ')' in line.strip():
                    skip_next = False
                continue
            else:
                new_lines.append(line)

        new_content = '\n'.join(new_lines)

        if new_content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return 1
        return 0

    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return 0

def remove_print_from_backend(filepath):
    """Remove print statements from Python files"""
    if should_ignore(filepath):
        return 0

    # Only process router files and core files
    if not ('routers/' in filepath or 'core.py' in filepath or 'server.py' in filepath):
        return 0

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        lines = content.split('\n')
        new_lines = []

        for line in lines:
            # Keep lines with KEEP comment
            if '# KEEP' in line or '# @security-keep' in line:
                new_lines.append(line)
                continue

            # Remove print statements
            if re.match(r'^\s*print\(', line):
                continue

            # Keep logger.info and logger.warning (they're controlled by log level)
            # Remove logger.debug in production routers
            if re.search(r'logger\.debug\(', line):
                continue

            new_lines.append(line)

        new_content = '\n'.join(new_lines)

        if new_content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return 1
        return 0

    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return 0

def main():
    print("🔒 Security Audit - Removing Debug Statements\n")

    # Process frontend files
    print("📁 Scanning frontend files...")
    js_files = []
    for ext in ['**/*.js', '**/*.jsx']:
        js_files.extend(glob.glob(f"{FRONTEND_SRC}/{ext}", recursive=True))

    frontend_modified = 0
    for filepath in js_files:
        if remove_console_logs_from_file(filepath):
            print(f"  ✓ Cleaned: {filepath}")
            frontend_modified += 1

    print(f"\n✅ Frontend: {frontend_modified} files modified\n")

    # Process backend files
    print("📁 Scanning backend files...")
    py_files = glob.glob(f"{BACKEND_DIR}/**/*.py", recursive=True)

    backend_modified = 0
    for filepath in py_files:
        if remove_print_from_backend(filepath):
            print(f"  ✓ Cleaned: {filepath}")
            backend_modified += 1

    print(f"\n✅ Backend: {backend_modified} files modified\n")

    print("=" * 60)
    print(f"🎉 Security Audit Complete!")
    print(f"   Frontend: {frontend_modified} files cleaned")
    print(f"   Backend:  {backend_modified} files cleaned")
    print("=" * 60)
    print("\n⚠️  IMPORTANT:")
    print("   1. Review changes with git diff")
    print("   2. Test application thoroughly")
    print("   3. Verify no critical logs were removed")
    print("   4. Run: npm run build in frontend/")

if __name__ == "__main__":
    main()
