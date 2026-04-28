/**
 * SmartFlowSocial control primitives — when to use what (do not use raw native
 * `<input type="checkbox|radio">` without `NativeCheckbox` / `NativeRadio`).
 *
 * - **Checkbox** (`checkbox.tsx`, `native-checkbox.tsx`): binary selection in a
 *   list or form (include/exclude, multi-select rows). Not for persist-on server
 *   preference toggles at large scale — see Switch for always-on settings UX.
 *
 * - **Radio** (`radio-group.tsx`, `native-radio.tsx`): exactly one choice from
 *   a mutually exclusive set. Prefer Radix `RadioGroup` when not submitting a
 *   plain HTML form; use `NativeRadio` inside Remix `<Form>` when `name`/`value`
 *   must post as standard fields.
 *
 * - **SelectableCard / ChoiceTile** (`features/campaign-ui/ChoiceTileGroup.tsx`):
 *   large visual single-choice tiles; hides a native radio (`sr-only`) or uses
 *   buttons — not a substitute for compact radios in dense forms.
 *
 * - **Switch** (`switch.tsx`): persistent on/off setting (feature flags,
 *   notifications). Do not replace radios/checkboxes semantically (WCAG expects
 *   checkbox/radio roles for multi vs exclusive selection).
 */

export {};
