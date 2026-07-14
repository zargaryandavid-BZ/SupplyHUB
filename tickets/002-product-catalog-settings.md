# Ticket 002 — Product catalog in Settings (categories + templates)

> Read `CURSOR_BRIEF.md` first and follow its conventions (server actions for writes,
> read helpers in `lib/data.ts` / a new module, `nextId()`/`now()`, manager-role guards,
> reuse `globals.css` classes, TDD for logic, end with `npm test` + `tsc` green).

> **Depends on / coordinates with Ticket 001.** This ticket changes the partner form's
> "categories they cover" field (introduced/edited in 001) from free text to a
> catalog-driven multi-select. Implement 001 first, then this.

## Goal
Stop free-typing products. The Distribution Manager maintains a **Product catalog** in a
new **Settings** area: top-level **categories** (Books, Banners, …) each containing
reusable **product templates** (e.g. "Hardcover Book A4" with default specs). The
**New request** form selects a category + optional template (template pre-fills the form),
and **partner "categories they cover"** are chosen from the same category list — so
"send to matching partners" becomes accurate.

---

## 1. Data model — `lib/types.ts`
Add two entities:

```ts
export type ProductCategory = {
  id: number;
  name: string;          // display name, e.g. "Books"
  slug: string;          // lowercase key, e.g. "books" — used for matching
  active: number;        // 1 / 0
};

export type ProductTemplate = {
  id: number;
  category_id: number;   // FK -> ProductCategory.id
  name: string;          // e.g. "Hardcover Book A4"
  default_specs: string | null;
  default_quantity: number | null;
  active: number;
};
```

### `lib/db.ts`
- Add `product_categories: ProductCategory[]` and `product_templates: ProductTemplate[]`
  to the `DB` type and to `seed()`.
- **Backward-compat** (mirror the existing `normalizePartner` pattern): in `db()`, after
  parsing `db.json`, if `raw.product_categories` / `raw.product_templates` are missing,
  populate them from `seedCategories()` / `seedTemplates()` so existing installs upgrade
  without a reset. Persist on next `save()`.

### Seed content (align with existing seeded requests)
Categories: Books, Brochures, Flyers, Posters, Banners, Signage, Packaging, Labels
(slugs = lowercased). Templates (examples — add a few):
- Books → "Hardcover Book A4" (`A4, 200pp, matte cover, sewn binding, full color`, qty 1000)
- Brochures → "Tri-fold Brochure A4" (`A4 tri-fold, 150gsm gloss, double sided, full color`, qty 5000)
- Banners → "Roll-up Banner 85×200" (`85x200cm, retractable stand, single sided`, qty 10)
- Packaging → "Mailer Box" (`corrugated, printed outside, custom size`, qty 500)

---

## 2. Pure logic module — `lib/catalog.ts` (write tests against this)

```ts
// categories
listCategories(): ProductCategory[]
listActiveCategories(): ProductCategory[]
categoryById(id: number): ProductCategory | undefined
addCategory(name: string): ProductCategory                 // derives slug, active=1
updateCategory(id, { name?, active? }): ProductCategory | undefined
deleteCategory(id): { ok: true } | { ok: false; reason: "in_use" }  // block if referenced
categoryInUse(id): boolean   // referenced by a template OR a partner's coverage

// templates
listTemplates(categoryId?: number): ProductTemplate[]
templateById(id: number): ProductTemplate | undefined
addTemplate(input): ProductTemplate
updateTemplate(id, input): ProductTemplate | undefined
deleteTemplate(id): { ok: true }
setTemplateActive(id, active: boolean): void

// helpers used by the request form + matching
resolveTemplate(templateId: number): { title?: string; category: string; specs: string|null; quantity: number|null } | undefined
partnersForCategory(slug: string): Partner[]   // active partners whose coverage includes slug
```

- `deleteCategory` is **blocked** (`reason: "in_use"`) when a template or any partner
  references it; the UI then offers **Deactivate** (`updateCategory(id,{active:0})`).
- Slugs are unique; `addCategory`/`updateCategory` reject duplicate slugs.

---

## 3. Server actions — `app/actions.ts`
Thin wrappers over `lib/catalog.ts`, all manager-guarded, `revalidatePath('/manager/settings')`:
`createCategory, updateCategory, deleteCategory, toggleCategoryActive,
createTemplate, updateTemplate, deleteTemplate, toggleTemplateActive`.

Also update **`createRequest`** (and `dispatchToPartners` if relevant): the form now
sends `category` (a category slug) and an optional `template_id`. If specs/quantity are
empty and a `template_id` is given, fill them from `resolveTemplate(template_id)`.

---

## 4. Settings UI — new page `app/manager/settings/page.tsx`
- Add a **Settings** link to `components/Sidebar.tsx` (manager nav).
- Two sections in `.card`s:
  - **Product categories:** table/list of categories with active toggle, edit (rename),
    delete (blocked→deactivate message via `?error=in_use`). Inline "add category" form.
  - **Product templates:** grouped by category; each shows name, default specs, default
    quantity; add/edit/delete. "Add template" form with a category `<select>`, name,
    default specs, default quantity.
- Reuse existing table/card/badge/button styles.

## 5. New request form — `app/manager/requests/new/page.tsx`
- Replace the free-text **Category** input with a `<select>` populated from
  `listActiveCategories()` (value = slug).
- Add a **Product template** `<select>` populated from templates in the chosen category.
  Selecting a template pre-fills **title**, **specs**, and **quantity** (all still editable).
- Because prefill needs interactivity, extract the form into a small client component
  (`"use client"`) — `components/NewRequestForm.tsx` — that receives `categories`,
  `templates`, `clients`, `partners` as props and posts to the `createRequest` server
  action. On template change, populate the fields from the template (client-side).
- **Matching:** when a category is selected, highlight/pre-check the partners whose
  coverage includes that category (use `partnersForCategory(slug)` server-side to mark
  them, or filter client-side from the passed partner list). Manager can still add others.

## 6. Partner form — `components/PartnerForm.tsx` (from Ticket 001)
- Change **"categories they cover"** from a free-text input to a **multi-select**
  (checkbox list) of `listActiveCategories()`. Store as before: a comma-separated list of
  category **slugs** in `partner.categories` (keep the field name/shape so existing
  matching and seed data keep working — seed slugs already match: books, brochures, …).
- Validation: only allow slugs that exist in the catalog.

---

## 7. Tests to write FIRST — `test/catalog.test.ts`
`resetDbForTests()` in `beforeEach`.
1. Seed catalog present: `listActiveCategories()` returns the seeded categories; each has
   a unique slug.
2. `addCategory("Stickers")` creates it with slug `stickers`, active=1; duplicate slug rejected.
3. `updateCategory` renames and can deactivate; deactivated excluded from `listActiveCategories()`.
4. `deleteCategory` blocked (`in_use`) when a template or a partner references it; succeeds
   for an unused category.
5. `addTemplate` under a category; `listTemplates(categoryId)` filters correctly;
   `templateById` returns default specs/quantity.
6. `resolveTemplate(id)` returns category slug + default specs + quantity for prefill.
7. `partnersForCategory("books")` returns only active partners whose `categories` include
   `books` (PrintPro + ColorMax from seed), never others.
8. Backward-compat: loading a `db.json` that lacks `product_categories`/`product_templates`
   yields the seeded catalog (simulate by writing a minimal db.json without those keys).
9. Regression: `test/data.test.ts` and `test/partners.test.ts` still pass.

---

## 8. Definition of done
- Tests green (`npm test`), `tsc` clean, `npm run build` compiles.
- Manager can manage categories + templates under **Settings**.
- New request form uses category `<select>` + template prefill; specs auto-fill and remain editable.
- Partner form's coverage is catalog-driven; matching partners are suggested on the request form.
- Existing seeded requests/partners still work (slugs align).
- Short PR summary noting the new entities, the Settings page, and the delete-vs-deactivate
  rule for categories.

## Out of scope (later)
Per-template pricing history, nested sub-categories, importing a catalog from a file,
and the production DB migration (Supabase) — the JSON store stays for now.
