import json
import os
from pathlib import Path
import subprocess
import sys

import pytest


def config_process(**settings):
    environment = os.environ.copy()
    for key in ('MAX_UPLOAD_MB', 'MAX_AUDIO_DURATION_SECONDS', 'AUDIO_CHUNK_SECONDS'):
        environment.pop(key, None)
    environment.update(settings)
    return subprocess.run([sys.executable, '-c',
        'import json, runtime_config as c; print(json.dumps([c.MAX_UPLOAD_MB,c.MAX_AUDIO_DURATION_SECONDS,c.AUDIO_CHUNK_SECONDS]))'],
        cwd=Path(__file__).resolve().parents[1], env=environment, capture_output=True, text=True)


def test_default_limits_support_two_hour_meetings():
    result = config_process()
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [256, 10800, 300]


def test_valid_machine_specific_limits_override_defaults():
    result = config_process(MAX_UPLOAD_MB=' 64 ', MAX_AUDIO_DURATION_SECONDS='7200', AUDIO_CHUNK_SECONDS='120')
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [64, 7200, 120]


@pytest.mark.parametrize('setting,value', [('MAX_UPLOAD_MB','0'), ('MAX_UPLOAD_MB','1025'),
    ('MAX_UPLOAD_MB','NaN'), ('MAX_UPLOAD_MB','3.5'), ('MAX_AUDIO_DURATION_SECONDS','59'),
    ('MAX_AUDIO_DURATION_SECONDS','21601'), ('AUDIO_CHUNK_SECONDS','29'), ('AUDIO_CHUNK_SECONDS','601')])
def test_invalid_limits_fail_startup_with_setting_name(setting, value):
    result = config_process(**{setting: value})
    assert result.returncode != 0
    assert f'ValueError: {setting}' in result.stderr
