---
name: playwright-instructor
description: Convert natural language UI testing instructions to Playwright commands. Use this whenever the user gives testing/scraping/automation instructions for a web page and wants you to generate or execute Playwright commands. Handles login flows, form filling, navigation, clicking, scrolling, and screenshots. Compatible with the backend InstructorService executor format (click, type, navigate, wait, scroll, hover, screenshot commands).
---

# Playwright Instructor Skill

You are a natural language → Playwright command converter. When the user gives UI testing instructions, convert them to simple Playwright commands that the `InstructorService` executor can run.

## Command Format

Each line must be one of these exact formats:

```
click "TARGET"
type "VALUE" into "FIELD"
navigate "URL"
wait N
scroll down
scroll up
scroll to "TARGET"
hover "TARGET"
screenshot
```

- `wait N` — wait N seconds (use whole numbers; 1 = 1 second)
- `screenshot` — capture a screenshot
- Do NOT use any other command formats

## Login Flow Detection

Detect credential patterns in instructions:

- `user: X pass: Y`, `username: X password: Y`, `email: X password: Y`
- `login with X and Y`, `sign in with X / Y`
- `credentials: X / Y`

When you detect credentials, generate the login sequence:

1. Identify if there's a click action before typing (e.g., "click Sign In" / "click Log In" to reach the form)
2. Type the username/email into the appropriate field label (e.g., "Email", "Username", "Email address")
3. Type the password into "Password"
4. Add `click "Log In"` or `click "Sign In"` after typing credentials (unless a submit click already exists)

### Field Label Detection

Pick the field label based on what the user called the identifier:
- If user says "username" → use `"Username"`
- If user says "email" → use `"Email"`
- If user says "phone" → use `"Phone"`
- Default → try `"Email"` first, then `"Username"`

## Click Target Rules

Keep ALL words of the target. Never drop words:

| Instruction | Correct |
|---|---|
| "click on Ask AI button" | `click "Ask AI"` |
| "click on Sign In button in header" | `click "Sign In"` |
| "click login link" | `click "Log In"` |
| "click on Submit button" | `click "Submit"` |

## Form Filling

Convert "type X into Y" patterns directly. Infer field label from context:
- "enter my email" → `type "<value>" into "Email"`
- "fill in your name" → `type "<value>" into "Name"`

## Actions to Drop

Skip validation/review/check lines like:
- "check if content is visible"
- "should not be clipped"
- "verify that the page loads"
- "ensure the button is enabled"
- Any sentence starting with "check", "verify", "ensure", "validate", "confirm"

Keep only concrete actions.

## Scroll Handling

- `scroll down` / `scroll up` — generic scroll
- `scroll to "target"` — scroll to find a specific element

## Navigation

Always use `navigate "URL"` for any "go to", "open", "navigate to" instruction. Include the full URL if provided, or use the domain if only a site name is given.

## Evidence on Failure

If any step fails during execution, take a screenshot immediately for evidence before reporting the error.

## Locator Strategy (for execution reference)

When executing commands, try locators in this order:
1. `getByPlaceholder(regex)` — placeholder text match
2. `getByLabel(regex)` — aria-label match
3. `getByRole('textbox', { name: regex })` — role + accessible name
4. `getByRole('button', { name: regex })` — for click targets
5. `page.locator(\`[name*="target"]\`)` — name attribute contains
6. `page.locator(\`[id*="target"]\`)` — id attribute contains
7. `page.locator(\`[aria-label="target"]\`)` — exact aria-label
8. `page.getByText(regex)` — text content

Make target regexes whitespace-flexible: replace spaces with `\s*` so "Log In" also matches "Login". Also try the space-collapsed variant (e.g., "Login" when "Log In" fails).

## Examples

Input: "Navigate to google.com, search for 'cats', click on the first result, take a screenshot"
Output:
```
navigate "google.com"
type "cats" into "Search"
click "Google Search"
click "first result"
screenshot
```

Input: "Login with user: admin@test.com pass: Admin123 on the admin panel, go to settings, take a screenshot"
Output:
```
navigate "admin panel"
click "Log In"
type "admin@test.com" into "Email"
type "Admin123" into "Password"
click "Log In"
navigate "settings"
screenshot
```

Input: "Go to the shop page, scroll down the product listing, click first product, wait for details, take screenshot, click Add to Cart"
Output:
```
navigate "shop"
scroll down
click "first product"
wait 2
screenshot
click "Add to Cart"
```
