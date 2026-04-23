# 🚀 CLAUDE CODE - QUICK TEST COMMANDO'S

## MAIN TEST COMMANDO

```
Test mijn volledige KOK Web Services project:
- Check alle buttons en of ze werken
- Verifieer alle routes en handlers
- Test responsive design
- Controleer accessibility
- Optimaliseer performance
- Fix alle problemen automatisch
- Maak een compleet test rapport

Volg de workflow in claude-code-testing-prompt.md
```

## SPECIFIEKE TESTS

### Alleen Buttons Testen
```
Test alle buttons in mijn project:
- Check of ze bestaan in DOM
- Verifieer event handlers
- Test of routes kloppen
- Check hover/active states
- Verifieer touch target sizes (min 44x44px)
- Test op mobiel
Fix problemen automatisch.
```

### Alleen Routes Testen
```
Test alle API routes:
- GET /
- GET /api/health
- POST /api/generate-website
Check handlers, error handling, CORS, validatie.
Fix problemen automatisch.
```

### Alleen UI/UX Testen
```
Test UI/UX van mijn project:
- Mobile responsive (375px, 768px, 1920px)
- Kleur contrast (WCAG AA)
- Typography (min 16px)
- Spacing consistentie
- Hover/focus states
Fix alles automatisch.
```

### Alleen Accessibility Testen
```
Test accessibility:
- Alt teksten
- ARIA labels
- Keyboard navigatie
- Focus indicators
- Form labels
- Heading hierarchy
Fix alles volgens WCAG AA.
```

### Performance Audit
```
Performance audit:
- Check file sizes
- Test laadtijd
- Optimize images
- Minify code
- Lazy loading
Geef rapport + fixes.
```

## SNEL FIX COMMANDO'S

### Fix Specifiek Probleem
```
Fix deze button: [button selector]
- Voeg hover state toe
- Maak 44x44px minimum
- Voeg loading state toe
- Verbeter accessibility
```

### Fix Alle Forms
```
Verbeter alle forms in mijn project:
- Voeg validatie toe
- Error messages
- Success feedback
- Loading states
- Auto-focus
- Enter key support
```

### Maak Responsive
```
Maak [component naam] volledig responsive:
- Test 375px (mobiel)
- Test 768px (tablet)
- Test 1920px (desktop)
Fix alle layout problemen.
```

## VOOR NIEUWE FEATURES

```
Ik ga [feature naam] toevoegen.
Test daarna automatisch:
- Alle nieuwe buttons
- Nieuwe routes
- UI consistency
- Accessibility
- Mobile responsive
Geef me een rapport.
```

## DEPLOYMENT CHECK

```
Final check voor deployment:
- Test ALLE functionaliteit
- Check ALLE routes
- Verifieer performance budgets
- Run accessibility audit
- Check cross-browser
- Genereer deployment checklist
```

## TROUBLESHOOTING

### Button werkt niet
```
Debug deze button: #generateBtn
- Check DOM
- Check event listener
- Check route handler
- Test error handling
- Check console errors
Geef me diagnose + fix.
```

### Route geeft error
```
Debug route: POST /api/generate-website
- Check handler functie
- Test met sample data
- Verifieer error handling
- Check CORS
- Test response format
Geef me diagnose + fix.
```

### Design inconsistent
```
Maak design consistent:
- Check alle kleuren tegen design system
- Verifieer spacing (4/8/16/24/32/48px)
- Check border-radius consistency
- Verifieer font sizes
Fix alles automatisch.
```

## RAPPORT OPTIES

### Kort rapport (1 pagina)
```
Geef me een 1-pagina test samenvatting:
- Overall score
- Top 5 problemen
- Top 5 fixes
- Belangrijkste aanbevelingen
```

### Volledig rapport
```
Genereer volledig test rapport:
- Alle button tests
- Alle route tests
- UI/UX analyse
- Accessibility score
- Performance metrics
- Complete fix lijst
- Aanbevelingen
Sla op als TEST_RAPPORT.md
```

### Developer checklist
```
Maak deployment checklist:
[ ] Alle buttons getest
[ ] Alle routes getest
[ ] Mobile responsive
[ ] Accessibility WCAG AA
[ ] Performance < 3s
[ ] No console errors
[ ] Cross-browser tested
```

## BEST PRACTICES

✅ **Start altijd met**: "Test mijn project volledig"
✅ **Voor nieuwe features**: Test direct na toevoegen
✅ **Voor deployment**: Run final check
✅ **Bij bugs**: Debug specifieke component
✅ **Wekelijks**: Performance audit

## VOORBEELD WORKFLOW

```bash
# 1. Initial test (eerste keer)
"Test mijn volledige KOK Web Services project volledig"

# 2. Na elke feature
"Ik heb een nieuwe download button toegevoegd. Test deze."

# 3. Voor deployment
"Final deployment check - test alles"

# 4. Wekelijkse maintenance
"Performance audit + accessibility check"
```

## PRO TIPS

💡 Claude Code kan tests automatisch runnen tijdens development
💡 Vraag om een "watch mode" voor continuous testing
💡 Laat Claude Code een test suite genereren (Jest/Vitest)
💡 Vraag om E2E tests met Playwright
💡 Laat automated git commits maken voor elke fix

## SAVE THIS WORKFLOW

```
# .claude/testing-workflow.md

1. Morning: "Quick health check van project"
2. Na feature: "Test nieuwe [feature]"
3. Voor commit: "Verify geen breaking changes"
4. Voor deploy: "Final deployment check"
5. Weekly: "Full audit + performance report"
```
