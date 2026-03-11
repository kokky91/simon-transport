# OSAGRO UI SYSTEM v1

Een schaalbaar, consistent en toekomstbestendig design-systeem voor `apps/osagro`.

---

## 1. Design Tokens (`src/app/styles.css`)

Dark is default.

## Foundation Tokens

```css
:root {
  /* Colors */
  --os-color-bg: #0f172a;
  --os-color-surface: #1e293b;
  --os-color-surface-elevated: #273449;
  --os-color-border: #334155;
  --os-color-primary: #22c55e;
  --os-color-warning: #f59e0b;
  --os-color-danger: #ef4444;
  --os-color-text: #e5e7eb;
  --os-color-text-muted: #94a3b8;

  /* Spacing scale */
  --os-space-xs: 4px;
  --os-space-sm: 8px;
  --os-space-md: 16px;
  --os-space-lg: 24px;
  --os-space-xl: 32px;

  /* Radius */
  --os-radius-sm: 6px;
  --os-radius-md: 10px;
  --os-radius-lg: 16px;

  /* Shadows */
  --os-shadow-soft: 0 4px 12px rgba(0,0,0,0.25);
  --os-shadow-elevated: 0 8px 24px rgba(0,0,0,0.35);

  /* Typography */
  --os-font-size-xs: 12px;
  --os-font-size-sm: 14px;
  --os-font-size-md: 16px;
  --os-font-size-lg: 20px;
  --os-font-size-xl: 28px;
}
```

## Light Theme Overrides

```css
[data-theme="light"] {
  --os-color-bg: #f8fafc;
  --os-color-surface: #ffffff;
  --os-color-surface-elevated: #f1f5f9;
  --os-color-border: #e2e8f0;
  --os-color-text: #0f172a;
  --os-color-text-muted: #475569;
}
```

---

## 2. Layout Primitives

## Base Layout Classes

```css
.os-page {
  background: var(--os-color-bg);
  color: var(--os-color-text);
  min-height: 100vh;
  padding: var(--os-space-xl);
}

.os-section {
  margin-bottom: var(--os-space-xl);
}

.os-card {
  background: var(--os-color-surface);
  border: 1px solid var(--os-color-border);
  border-radius: var(--os-radius-md);
  padding: var(--os-space-lg);
  box-shadow: var(--os-shadow-soft);
}

.os-grid {
  display: grid;
  gap: var(--os-space-lg);
}

.os-stack {
  display: flex;
  flex-direction: column;
  gap: var(--os-space-md);
}
```

---

## 3. UI Primitives

## Buttons

```css
.os-button {
  background: var(--os-color-primary);
  color: #000;
  padding: var(--os-space-sm) var(--os-space-md);
  border-radius: var(--os-radius-sm);
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.os-button--danger {
  background: var(--os-color-danger);
  color: #fff;
}
```

## Inputs

```css
.os-input {
  background: var(--os-color-surface-elevated);
  border: 1px solid var(--os-color-border);
  padding: var(--os-space-sm);
  border-radius: var(--os-radius-sm);
  color: var(--os-color-text);
}
```

---

## 4. Layout Types

## Form Layout

* Max-width: 480px
* Centered
* Vertical stack (`spacing-lg`)

## Data Layout

* Grid based
* Cards
* Consistente chart padding

## Live Layout

* Fullscreen
* Minimal padding
* Donkerdere surface variant

---

## 5. Regels

1. Geen inline styles voor structurele UI.
2. Geen hardcoded colors in features.
3. Nieuwe kleuren altijd eerst als token toevoegen.
4. Layout via primitives, niet per feature opnieuw.
5. Light/dark alleen via token overrides.

---

## 6. Refactor Volgorde

1. Login
2. Dashboard
3. Admin
4. Tasks
5. Simulations

Elke feature wordt herschreven naar primitives.

---

## 7. UI Definition of Done

* Geen hardcoded styling in features
* Geen inline margins/paddings
* Geen losse radius/shadow waarden
* Donker thema consistent
* Light theme werkt via override

---

## Einde OSAGRO UI SYSTEM v1
