import os

TEMPLATE = """
# {feature} feature

## Purpose
Beschrijving van de {feature} feature.

## Structure

```
{feature}/
api/
components/
hooks/
pages/
store/
types.ts
route.tsx
```

## Responsibilities

- UI voor {feature}
- API integratie
- state management

## API boundary

Alle requests lopen via:

```
src/lib/api/client.ts
```

## State

Feature state via Zustand.

## Routes

/{feature}

## Future improvements

- uitbreidingen
- AI integratie
"""

FEATURES_DIR = "apps/osagro/src/features"

for feature in os.listdir(FEATURES_DIR):
    path = os.path.join(FEATURES_DIR, feature)

    if os.path.isdir(path):
        readme = os.path.join(path, "README.md")

        if not os.path.exists(readme):
            with open(readme, "w") as f:
                f.write(TEMPLATE.format(feature=feature))

print("Feature READMEs generated.")
