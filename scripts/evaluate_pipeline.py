"""Reproducible evaluation CLI. Does not load the application .env."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0,str(ROOT))

from scripts.evaluation.adapters import PipelineAdapter
from scripts.evaluation.datasets import prepare_fleurs
from scripts.evaluation.manifest import load_cases
from scripts.evaluation.reports import generate_reports
from scripts.evaluation.runner import run_evaluation


def main(argv=None, *, adapter=None):
    parser = argparse.ArgumentParser(description='Clarion evaluation: real measurements, explicit failures and human-reviewed NLP.')
    commands = parser.add_subparsers(dest='command',required=True)
    prepare = commands.add_parser('prepare-fleurs',help='Prepare a bounded public Vietnamese reading-speech pilot')
    prepare.add_argument('--output',type=Path,default=Path('.evaluation-data/fleurs-vi'))
    prepare.add_argument('--limit',type=int,default=20)
    for name in ('preflight','run'):
        command = commands.add_parser(name)
        command.add_argument('--models',nargs='+',choices=['tiny','base'],default=['tiny','base'])
        command.add_argument('--llm-model',default='llama3:latest')
        command.add_argument('--allow-model-download',action='store_true')
        if name == 'run':
            command.add_argument('--manifest',type=Path,action='append',required=True)
            command.add_argument('--output',type=Path,default=Path('.evaluation-runs'))
    report = commands.add_parser('report')
    report.add_argument('run_dir',type=Path)
    report.add_argument('--review-csv',type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == 'prepare-fleurs':
            print(prepare_fleurs(args.output,limit=args.limit))
        elif args.command == 'preflight':
            metadata = (adapter or PipelineAdapter()).preflight(args.models,allow_download=args.allow_model_download)
            if 'llm_models' in metadata and not any(m['name']==args.llm_model for m in metadata['llm_models']):
                raise ValueError('Requested LLM is not installed; prepare it explicitly outside evaluation')
            print(json.dumps(metadata,ensure_ascii=False,indent=2))
        elif args.command == 'run':
            for path in args.manifest:
                load_cases(path)  # Fail before any model/network operation for malformed input.
            directory = run_evaluation(args.manifest,args.output,models=args.models,llm_model=args.llm_model,
                                       allow_download=args.allow_model_download,adapter=adapter)
            generate_reports(directory)
            run = json.loads((directory/'run.json').read_text(encoding='utf-8'))
            print(json.dumps({'run_dir':str(directory),'status':run['status'],
                              'completed':sum(r['status']=='ok' for r in run['rows']), 'attempted':len(run['rows'])}))
            return 0 if run['status']=='complete' else 1
        elif args.command == 'report':
            for path in generate_reports(args.run_dir,review_csv=args.review_csv):
                print(path)
        return 0
    except (ValueError,FileNotFoundError) as exc:
        print(str(exc),file=sys.stderr)
        return 2
    except RuntimeError as exc:
        # Our runtime messages contain fixed preparation guidance, never provider responses.
        print(str(exc),file=sys.stderr)
        return 2
    except Exception as exc:
        print(f'Evaluation failed ({type(exc).__name__}); inspect retained run artifacts. No secrets logged.',file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
