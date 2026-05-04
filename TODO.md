# Frontend Enhancement TODO
Current working directory: /Users/shantanu/Desktop/reskil_2/ml_test_ui/src/

## Logical Steps from Approved Plan

### Phase 1: Setup & Core Polish (Polish existing, add contexts) ✓
- [x] Update package.json (add missing deps/scripts)
- [x] Create contexts/ThemeContext.tsx, JobContext.tsx, AnalyticsContext.tsx
- [ ] Wrap App.tsx in providers + add theme toggle/bottom nav/keyboard shortcuts
- [x] Enhance index.css + create animations.css/mobile.css/print.css (animations done)

**Progress: 12/18 steps complete**

### Phase 2: StudioPage + Wizard UX
- [ ] Create/populate components/wizard/EventWizard.tsx (multi-step)
- [ ] Integrate wizard in StudioPage.tsx (replace form, add FileQueue/toasts/skeletons)
- [ ] Backend: Add WS endpoint in api/main.py

### Phase 3: ResultsPage + Features
- [ ] Enhance ResultsPage.tsx (refine split-pane, add CaptionEditor/HashtagGenerator)
- [ ] Create components/export/PDFReport.tsx + BulkDownload
- [ ] Frontend: Update api.ts + hooks for WS (replace polling w/ sockets)

### Phase 4: New Features
- [ ] Create pages/AnalyticsPage.tsx + contexts/analytics
- [ ] Add components/onboarding/GuidedTour.tsx + trigger in App
- [ ] Mobile: BottomNav.tsx, responsive overrides

### Phase 5: Perf/A11y/Polish
- [ ] Add hooks: useImageOptimization/useToast/useAnalytics
- [ ] Accessibility: ARIA, focus, skip-link, high-contrast
- [ ] Perf: Lazy load, IntersectionObserver, code splitting

### Phase 6: Test & Complete
- [ ] Install: cd ml_test_ui && npm i
- [ ] Test wizard/sockets/mobile/PDF/tour
- [ ] Lint: npm run lint
- [ ] attempt_completion

**Progress: 0/18 steps complete**

