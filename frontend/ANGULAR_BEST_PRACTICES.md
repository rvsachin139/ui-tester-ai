# Angular Best Practices — UI Tester AI

Compiled from [angular.dev/style-guide](https://angular.dev/style-guide), [angular.dev/best-practices](https://angular.dev/best-practices), and the [Angular blog](https://blog.angular.dev) (v19–v22).

---

## 1. Standalone Components (Always)

- Do NOT set `standalone: true` — it's the default since v19
- Use `standalone: false` only if a component still relies on `@NgModule`
- Use `provideRouter`, `provideHttpClient`, etc. in `app.config.ts` instead of `AppModule`
- Prefer `imports` array in `@Component` over `NgModule` imports

## 2. Signals Over RxJS for State

- Use `signal()` for local component state
- Use `computed()` for derived/transformed state
- Use `input()` and `output()` functions instead of `@Input()` / `@Output()` decorators
- Use `model()` for two-way binding signals
- Use `effect()` sparingly — only when side effects are truly needed
- Do NOT use `mutate()` on signals — use `set()` or `update()` instead
- For async data, use `resource()` / `rxResource()` (stable since v19)

## 3. Dependency Injection

- Use `inject()` function instead of constructor injection

```ts
private readonly api = inject(ApiService);   // ✅
constructor(private api: ApiService) {}       // ❌
```

- Use `providedIn: 'root'` for singleton services
- Use `@Service()` decorator for new singleton services (v22+)
- Mark injected dependencies as `readonly`

## 4. Components & Templates

### 4.1 Structuring Components

- Group Angular-specific properties at the top: injects → inputs → outputs → queries → signals → methods
- Use `protected` for template-accessible members, not `public`
- Use `readonly` for inputs, outputs, and injected services
- Keep components focused on presentation — extract logic into services

### 4.2 Templates

- Use native control flow: `@if`, `@for`, `@switch` — NOT `*ngIf`, `*ngFor`, `*ngSwitch`
- Use `class` / `style` bindings instead of `ngClass` / `ngStyle`
- Use `@defer` for lazy-loading heavy components below the fold
- Keep logic out of templates — use `computed()` in the class instead
- Name event handlers for what they DO (`saveUser()`), not the event (`handleClick()`)

```html
<!-- ✅ Good -->
@if (isLoggedIn()) {
  <button (click)="logout()">Log out</button>
}

<!-- ❌ Avoid -->
<div *ngIf="isLoggedIn()">
  <button (click)="handleClick($event)">Log out</button>
</div>
```

## 5. Forms

### 5.1 Preferred: Signal Forms (v22+)

- Signal Forms (`@angular/forms/signals`) provide signal-based state, type-safe fields, and schema validation
- For Angular 19, Reactive Forms (`@angular/forms`) are the standard

### 5.2 Reactive Forms (current project standard)

- Use `FormControl`, `FormGroup`, `FormBuilder` from `@angular/forms`
- Prefer Reactive Forms over template-driven `[(ngModel)]` for any non-trivial form
- Use typed forms (`FormGroup<{...}>`) for type safety
- Define validators as functions, not directives

### 5.3 Template-Driven Forms (simple cases only)

- `[(ngModel)]` is acceptable for simple standalone fields (e.g., single input/textarea)
- Avoid for complex or nested forms

## 6. Performance

### 6.1 Lazy Loading

- Lazy-load secondary routes with `loadComponent`:

```ts
{
  path: 'admin',
  loadComponent: () => import('./admin/admin.component').then(m => m.AdminComponent)
}
```

- Use `@defer` for heavy components not in the initial viewport:

```html
@defer (on viewport) {
  <heavy-chart />
} @placeholder {
  <div class="skeleton placeholder"></div>
}
```

### 6.2 Images

- Use `NgOptimizedImage` (`provideImgixLoader`) for all static images
- Do NOT use inline base64 images with `NgOptimizedImage`

### 6.3 Change Detection

- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly — it's the default in v22+
- Rely on signals for fine-grained reactivity

## 7. Routing

- Use `provideRouter()` with `withComponentInputBinding()` in `app.config.ts`
- Prefer `loadComponent` for lazy routes
- Use route guards as functions (`canActivate`, `canMatch`) rather than class-based guards
- Use `ActivatedRoute` with `inject()` for reading params/query

## 8. HTTP & Data Fetching

- Use `provideHttpClient(withFetch())` for the modern `fetch`-based client
- Use `resource()` / `rxResource()` (stable v19+) for declarative async state tied to signals
- Use `HttpInterceptorFn` functions instead of class-based `HttpInterceptor`

```ts
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  console.log(req.url);
  return next(req);
};
```

## 9. Lifecycle Hooks

- Keep lifecycle methods simple — extract logic into named methods
- Use `ngOnInit` interface for type safety
- Prefer `afterRender` / `afterNextRender` over `ngAfterViewInit` where applicable

## 10. Testing

- Co-locate `.spec.ts` files next to their source files
- Use `TestBed` with `provideRouter`, `provideHttpClient` etc. — avoid `TestBed.configureTestingModule` with NgModules
- Use `ComponentFixture` with `autoDetectChanges` for signal-based components
- Prefer `harness`-based testing (`@angular/cdk/testing`) for complex components

## 11. File & Project Organization

- Organize by feature, not by type:

```
src/app/
├── dashboard/        # ✅ Feature directory
│   ├── dashboard.component.ts
│   ├── dashboard.component.html
│   ├── dashboard.component.css
│   └── dashboard.component.spec.ts
├── services/
│   └── api.service.ts
```

- One concept per file (one component, directive, or service per file)
- Use `kebab-case` for file names matching the class/component name
- Tests end with `.spec.ts`

## 12. Accessibility

- Use semantic HTML: `<button>`, `<nav>`, `<main>`, `<header>`, `<footer>`
- Use `aria-label`, `aria-labelledby`, `role` where semantics are insufficient
- Use `@angular/cdk/a11y` (`LiveAnnouncer`, `FocusTrap`, `FocusMonitor`)
- Ensure all interactive elements are keyboard-navigable

## 13. Migrations Available

Run these schematics after `ng update` to modernize:

```bash
ng generate @angular/core:inject-migration
ng generate @angular/core:signal-input-migration
ng generate @angular/core:signal-queries-migration
ng generate @angular/core:output-migration
ng generate @angular/core:signals --best-effort-mode
```

---

## Current Project Audit

| Area | Status (v19) | Target |
|------|-------------|--------|
| Standalone | ✅ Default | No change needed |
| Signals | 🟡 Mix of signals + RxJS | Use signal()/computed() for all component state |
| `input()` / `output()` | ❌ Uses `@Input()` / `@Output()` | Migrate to `input()` / `output()` |
| `inject()` | ❌ Constructor injection | Migrate to `inject()` |
| Native control flow | 🟡 Mix of `@if`/`@for` + some `*ngIf` | Fully migrate to native flow |
| `[(ngModel)]` | 🟡 Simple fields only | Acceptable for simple cases |
| Lazy loading | ❌ Not implemented | Add `loadComponent` for routes |
| `@defer` | ❌ Not implemented | Defer heavy components |
| `NgOptimizedImage` | N/A | Use when images are added |
| `protected` | 🟡 Mixed | Use consistently |
| `readonly` | ❌ Not used | Add to inputs, outputs, injects |
