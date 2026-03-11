import os
import sys
from pathlib import Path

# Basispaden die je altijd wilt uitklappen
EXPAND_PATHS = [
    'services',
    'services/api',
    'services/api/app',
    'services/api/app/core',
    'services/api/app/routes',
    'services/api/app/schemas',
    'services/api/app/services',
    'services/realtime',
    'services/realtime/app',
    'packages',
    'packages/contracts',
    'packages/contracts/src',
    'packages/contracts/src/events',
    'infrastructure',
    'infrastructure/docker',
    'infrastructure/monitoring',
    'infrastructure/terraform',
    'database',
    'database/migrations',
    'database/seeds',
]

# Deze paden worden altijd ingeklapt (hebben prioriteit op expand)
COLLAPSE_PATHS = []

# Output als markdown of tekst
OUTPUT_MARKDOWN = True

# Hoofdmap van het project
ROOT = Path(__file__).parent


def supports_unicode_tree() -> bool:
    if os.getenv('TREE_ASCII', '').strip().lower() in {'1', 'true', 'yes', 'on'}:
        return False

    encoding = (sys.stdout.encoding or '').lower()
    if not encoding:
        return False

    try:
        '└├│'.encode(encoding)
        return True
    except UnicodeEncodeError:
        return False


def normalize_rel_path(path: str) -> str:
    """Normalize a relative path by stripping whitespace, replacing backslashes with forward slashes, and stripping trailing slashes."""
    return path.strip().replace('\\', '/').strip('/')


def detect_app_src_paths(root: Path, base: str = 'apps'):
    base_path = root / normalize_rel_path(base)
    if not base_path.is_dir():
        return []

    paths = []
    for app_dir in sorted(entry for entry in base_path.iterdir() if entry.is_dir()):
        src_dir = app_dir / 'src'
        if src_dir.is_dir():
            app_rel = normalize_rel_path(str(app_dir.relative_to(root)))
            src_rel = normalize_rel_path(str(src_dir.relative_to(root)))
            paths.append(app_rel)
            paths.append(src_rel)

    return paths


def resolve_paths(root: Path, paths: list[str]):
    normalized_paths = [normalize_rel_path(path) for path in paths if normalize_rel_path(path)]
    deduplicated_paths = list(dict.fromkeys(normalized_paths))
    existing = [path for path in deduplicated_paths if (root / path).is_dir()]
    missing = [path for path in deduplicated_paths if path not in existing]
    return existing, missing


def is_path_match(path: Path, paths: tuple[str, ...]):
    rel = normalize_rel_path(str(path.relative_to(ROOT)))
    return any(rel == candidate or rel.startswith(f'{candidate}/') for candidate in paths)


def is_expand_path(path: Path, expand_paths: tuple[str, ...]):
    rel = normalize_rel_path(str(path.relative_to(ROOT)))
    return any(
        rel == candidate
        or rel.startswith(f'{candidate}/')
        or candidate.startswith(f'{rel}/')
        for candidate in expand_paths
    )


def should_collapse_path(path: Path, collapse_paths: tuple[str, ...]):
    if path.name in {'node_modules', '__pycache__', 'venv', '.venv', 'dist'}:
        return True
    return is_path_match(path, collapse_paths)


def has_children(path: Path):
    try:
        next(path.iterdir())
        return True
    except (StopIteration, OSError):
        return False


def print_tree(path: Path, expand_paths: tuple[str, ...], collapse_paths: tuple[str, ...], prefix='', expanded=False):
    try:
        entries = sorted([e for e in path.iterdir() if not e.name.startswith('.')])
    except OSError:
        return

    for i, entry in enumerate(entries):
        is_last = i == len(entries) - 1
        if supports_unicode_tree():
            connector = '└── ' if is_last else '├── '
            child_prefix = '    ' if is_last else '│   '
        else:
            connector = '\\-- ' if is_last else '|-- '
            child_prefix = '    ' if is_last else '|   '

        line = f'{prefix}{connector}{entry.name}'
        print(line)
        if entry.is_dir():
            if should_collapse_path(entry, collapse_paths):
                if has_children(entry):
                    print(f'{prefix}    ...')
            elif expanded or is_expand_path(entry, expand_paths):
                print_tree(entry, expand_paths, collapse_paths, prefix + child_prefix, True)
            else:
                # Ingeklapt
                if has_children(entry):
                    print(f'{prefix}    ...')


if __name__ == '__main__':
    # Optioneel extra paden via env var, gescheiden door ; of ,
    extra_expand_raw = os.getenv('TREE_EXPAND_PATHS', '')
    extra_expand_paths = [part.strip() for part in extra_expand_raw.replace(';', ',').split(',') if part.strip()]
    auto_expand_paths = detect_app_src_paths(ROOT)
    extra_collapse_raw = os.getenv('TREE_COLLAPSE_PATHS', '')
    extra_collapse_paths = [part.strip() for part in extra_collapse_raw.replace(';', ',').split(',') if part.strip()]

    resolved_expand_paths, missing_expand_paths = resolve_paths(
        ROOT,
        [*EXPAND_PATHS, *auto_expand_paths, *extra_expand_paths],
    )
    resolved_collapse_paths, missing_collapse_paths = resolve_paths(ROOT, [*COLLAPSE_PATHS, *extra_collapse_paths])

    expand_paths = tuple(resolved_expand_paths)
    collapse_paths = tuple(resolved_collapse_paths)

    if missing_expand_paths:
        print('Waarschuwing: deze expand-paden bestaan niet en worden overgeslagen:')
        for missing in missing_expand_paths:
            print(f'  - {missing}')

    if missing_collapse_paths:
        print('Waarschuwing: deze collapse-paden bestaan niet en worden overgeslagen:')
        for missing in missing_collapse_paths:
            print(f'  - {missing}')

    print(f'{ROOT.name}/')
    print_tree(ROOT, expand_paths, collapse_paths, '', False)

