"""Build a commit-addressed hand-in archive without local data or Git history.

Uses only the Python standard library and Git. Known credential patterns are a
bounded release check, not an exhaustive secret detector or security audit.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True)
    if result.returncode:
        raise ValueError('Git operation failed: ' + ' '.join(args[:2]))
    return result.stdout


def validate_path(name):
    path = PurePosixPath(name)
    parts = {part.casefold() for part in path.parts}
    leaf = path.name.casefold()
    excluded = {'.git', 'node_modules', 'venv', '.venv', '__pycache__',
                '.pytest_cache', '.evaluation-data', '.evaluation-runs',
                'dist', 'backups', '.vscode', '.superpowers'}
    if (path.is_absolute() or '..' in path.parts or parts & excluded or path.parts[0].casefold() == 'data'
            or (leaf.startswith('.env') and leaf != '.env.example')
            or leaf.endswith('.env')
            or re.search(r'\.(?:db|sqlite|sqlite3)(?:-.*)?$|\.py[co]$|\.pem$|\.key$', leaf)):
        raise ValueError(f'Excluded runtime path is committed: {name}')


SECRET_PATTERNS = (
    rb'GOCSPX-[A-Za-z0-9_-]{20,}',
    rb'gh[pousr]_[A-Za-z0-9]{30,}',
    rb'github_pat_[A-Za-z0-9_]{40,}',
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'(?:GOOGLE|GITHUB)_CLIENT_SECRET\s*=\s*[\x22\x27]?[A-Za-z0-9_-]{20,}',
)


def build_package(root, output):
    root, output = Path(root).resolve(), Path(output).resolve()
    revision = git(root, 'rev-parse', 'HEAD').decode().strip()
    if git(root, 'diff', '--name-only', 'HEAD', '--'):
        raise ValueError('Commit uncommitted tracked changes before packaging.')
    files = {}
    for entry in git(root, 'ls-tree', '-rz', '--full-tree', 'HEAD').split(b'\0'):
        if not entry:
            continue
        metadata, encoded_name = entry.split(b'\t', 1)
        mode, kind, _ = metadata.split()
        name = encoded_name.decode('utf-8')
        validate_path(name)
        if kind != b'blob' or mode not in {b'100644', b'100755'}:
            raise ValueError(f'Unsupported archive entry: {name}')
        files[name] = None

    # Git produces stable ZIP bytes for the same commit, independent of local
    # ignored/untracked files. Validate everything before creating output.
    archive_bytes = git(root, '-c', 'core.autocrlf=false', '-c', 'core.eol=lf',
                        'archive', '--format=zip', '--prefix=Clarion/', revision)
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        for name in files:
            data = archive.read('Clarion/' + name)
            if any(re.search(pattern, data) for pattern in SECRET_PATTERNS):
                raise ValueError(f'Potential credential in committed file: {name}')
            files[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

    output.mkdir(parents=True, exist_ok=True)
    archive_name = f'Clarion-Source-{revision[:12]}.zip'
    archive_path = output / archive_name
    manifest = {
        'schema_version': 1, 'commit': revision, 'archive': archive_name,
        'archive_sha256': hashlib.sha256(archive_bytes).hexdigest(),
        'file_count': len(files), 'files': files,
        'scope': 'Committed source, documentation, public samples and evidence; no Git history or local runtime data.',
    }
    archive_path.write_bytes(archive_bytes)
    (output / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    (output / 'START_HERE.txt').write_text(
        f'CLARION SUBMISSION\nCommit: {revision}\n\n'
        f'Extract {archive_name}. Read Clarion/docs/submission/README.md first.\n'
        'Read Clarion/docs/submission/HANDOFF.md for the English team handoff.\n'
        'MANIFEST.json records the archive and per-file SHA-256 checksums.\n'
        'OAuth clients and model weights must be configured separately.\n', encoding='utf-8')
    return archive_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('dist/submission'))
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    try:
        archive = build_package(root, args.output)
    except (ValueError, OSError) as error:
        parser.exit(2, f'Packaging stopped: {error}\n')
    print(f'Created {archive}')
    print(f'Checksums: {archive.parent / "MANIFEST.json"}')


if __name__ == '__main__':
    main()
