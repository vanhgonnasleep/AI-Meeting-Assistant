"""The hand-in archive must describe committed code and exclude runtime secrets."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import zipfile

import pytest


SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/submission/package_source.py'


def packager():
    spec = importlib.util.spec_from_file_location('submission_packager', SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.STDOUT)


@pytest.fixture
def repository(tmp_path):
    root = tmp_path / 'repository'
    root.mkdir()
    git(root, 'init')
    git(root, 'config', 'user.email', 'fixture@example.invalid')
    git(root, 'config', 'user.name', 'Submission fixture')
    git(root, 'config', 'core.autocrlf', 'true')
    (root / 'README.md').write_text('Committed source\n', encoding='utf-8')
    (root / '.env.example').write_text('GOOGLE_CLIENT_SECRET=\n', encoding='utf-8')
    git(root, 'add', '.')
    git(root, 'commit', '-m', 'fixture')
    return root


def test_archive_uses_only_committed_files_and_is_reproducible(repository, tmp_path):
    (repository / '.env').write_text('untracked private configuration', encoding='utf-8')
    (repository / 'meeting.db').write_bytes(b'private runtime database')
    first = packager().build_package(repository, tmp_path / 'first')
    second = packager().build_package(repository, tmp_path / 'second')
    assert first.read_bytes() == second.read_bytes()
    with zipfile.ZipFile(first) as archive:
        assert set(archive.namelist()) == {'Clarion/', 'Clarion/.env.example', 'Clarion/README.md'}
        assert archive.read('Clarion/README.md') == git(repository, 'show', 'HEAD:README.md')
    manifest = json.loads((first.parent / 'MANIFEST.json').read_text(encoding='utf-8'))
    assert manifest['commit'] == git(repository, 'rev-parse', 'HEAD').decode().strip()
    assert manifest['archive_sha256'] == hashlib.sha256(first.read_bytes()).hexdigest()
    assert manifest['files']['README.md']['sha256'] == hashlib.sha256(git(repository, 'show', 'HEAD:README.md')).hexdigest()


def test_dirty_tracked_code_is_rejected(repository, tmp_path):
    (repository / 'README.md').write_text('Uncommitted replacement', encoding='utf-8')
    with pytest.raises(ValueError, match='uncommitted'):
        packager().build_package(repository, tmp_path / 'out')
    assert not (tmp_path / 'out').exists()


def test_committed_feature_data_is_source_not_the_private_runtime_directory(repository, tmp_path):
    fixture = repository / 'src/features/preview/data/sample.json'
    fixture.parent.mkdir(parents=True)
    fixture.write_text('{"sample": true}', encoding='utf-8')
    git(repository, 'add', '.')
    git(repository, 'commit', '-m', 'public source fixture')
    archive = packager().build_package(repository, tmp_path / 'out')
    with zipfile.ZipFile(archive) as contents:
        assert 'Clarion/src/features/preview/data/sample.json' in contents.namelist()


@pytest.mark.parametrize('name', ['.env', 'data/users/alice/meeting.db', 'node_modules/private.txt'])
def test_accidentally_committed_private_or_generated_files_are_rejected(repository, tmp_path, name):
    path = repository / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('private fixture', encoding='utf-8')
    git(repository, 'add', '.')
    git(repository, 'commit', '-m', 'unsafe fixture')
    with pytest.raises(ValueError, match='Excluded runtime path'):
        packager().build_package(repository, tmp_path / 'out')


def test_known_secret_literal_is_rejected_without_echoing_its_value(repository, tmp_path):
    secret = 'GOCSPX-' + 'fixture_only_123456789012345678901234'
    (repository / 'config.py').write_text('secret = ' + repr(secret), encoding='utf-8')
    git(repository, 'add', '.')
    git(repository, 'commit', '-m', 'unsafe literal fixture')
    with pytest.raises(ValueError, match='Potential credential') as error:
        packager().build_package(repository, tmp_path / 'out')
    assert secret not in str(error.value)
