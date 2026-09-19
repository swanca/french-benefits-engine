# French benefits engine

A deterministic eligibility engine for French social benefits. Given a household profile, it returns
leads worth checking — never a decision, and never an amount it cannot justify.

The design constraint that shapes everything else: **a rule is validated data, never executable
code.** No `eval`, no JavaScript typed into a back office, no condition string interpreted at
runtime. A rule is a JSON object that a schema accepts or rejects before the engine ever sees it.

## Why that matters

The obvious way to build this is to let an administrator write conditions as code, so new benefits
can be added without a deploy. That design fails in two directions at once: it is a remote code
execution hole wearing a CMS costume, and it makes the rules untestable, because you cannot diff or
review a behaviour you can only observe by running it.

So rules are data:

```json
{
  "rightId": "prime-activite",
  "version": 1,
  "required": ["age", "activity"],
  "any": [
    { "field": "activity", "values": ["employee", "independent", "student"] }
  ],
  "note": "Vérifiez les revenus d'activité, les ressources du foyer et les situations particulières dans le simulateur officiel."
}
```

The vocabulary is deliberately small. `required` names the answers the rule needs before it will
say anything. `any` is a set of alternative criteria, each either an inclusive numeric bound
(`min` / `max`) or a set of accepted values. `advisories` attach a caveat that appears only when its
`when` criterion matches — that is how the under-25 RSA exceptions surface without pretending to
decide them.

Anything a rule cannot express is a rule the engine refuses to publish, which is the intended
pressure: it forces the gap into the open rather than into a lambda.

## What the engine guarantees

These are enforced in code and covered by tests, not merely documented:

- **Nothing medical is ever inferred.** AAH returns a referral to the MDPH even if an injected
  catalogue tries to make it computable. The disability question that exists asks about an
  administrative status, never a condition.
- **"Not eligible" is never invented.** A profile the rules do not cover returns `outside`, with
  wording that says so, because an unmodelled case is not an administrative refusal.
- **Benefits already received are excluded** from any additional gain, including after their review
  window expires.
- **Stale rules stop answering.** Both the entry and the catalogue carry a review window; once past,
  the result is `expired` and the user is sent to the official source. A future or malformed date
  fails the same way, rather than being treated as valid.
- **Missing answers stay missing.** They produce `missing` with the list of fields, never a guess.
  Zero children is an answer; no answer is not.
- **The engine is pure.** No database, no network, no storage. It takes a profile and a catalogue
  and returns matches.

An invalid catalogue does not degrade into permissive behaviour: it yields "orientation
unavailable", never a positive match.

## Status values

| Status | Meaning |
|---|---|
| `possible` | Worth checking with the awarding body. Not a decision, not an amount. |
| `missing` | The rule needs answers the profile does not have. The fields are listed. |
| `outside` | The rules do not model this situation. Explicitly not a refusal. |
| `expired` | The entry or the catalogue is past its review window. |
| `received` | Declared as already received, so excluded from additional gain. |

## Usage

```ts
import { evaluateRights } from './src/engine';

const matches = evaluateRights(profile, rights);
// Optionally pass your own validated catalogue and a reference date:
// evaluateRights(profile, rights, catalog, new Date('2026-09-19'))
```

Without an explicit catalogue, the versioned JSON in `rules/` is used. `parseRightRules` validates a
catalogue and rejects unknown properties, sensitive fields, empty or contradictory criteria,
duplicate identifiers and impossible dates. Every field referenced by a selection criterion must
also appear in that rule's required answers, so a rule cannot silently branch on data it never
asked for.

## Tests

```bash
npm install
npm test
npm run typecheck
```

22 tests. They cover the guarantees above rather than the happy path: the under-25 RSA exceptions,
the absence of medical inference even with a hostile catalogue, non-executable condition strings,
expired and malformed dates, received benefits, profile validation stripping unknown sensitive
fields, and the ARE daily-allowance arithmetic.

## Scope and limits

The engine computes no means-testing scales, no reference income, no regulatory household
composition, no habitual residence and no medical entitlement. It does not simulate family
allowances: the profile holds neither the children's ages nor the reference tax income that would
require. No aggregate total is produced, because summing benefits that interact would be wrong.

Twelve orientations are covered: RSA, the activity bonus, APL, AAH, CROUS grants, the energy
voucher, the school-year allowance, family allowances, ASPA, France Travail childcare support, ARCE
and ARE.

**The rule catalogue's review dates are from September 2026 and are not maintained here.** Before
relying on this for anything real, re-read the consolidated legal texts and the current scales. A
rule engine is only as current as its parameters, and this repository does not promise to track
French legislation.

Amounts, where the wider project produced them, came from
[OpenFisca-France](https://github.com/openfisca/openfisca-france), the government's own
microsimulation engine. **The adapter that bridges to it is not included here**: OpenFisca is
AGPL-3.0, and shipping a module that links it under MIT would misrepresent that licence. This
repository is the orientation engine only.

`rights-simulation.ts` therefore ships the request and response contract with its validation, but
not the service that fulfils it.

## Origin

Extracted from Plus en Poche, a personal finance review for French households. The application
itself is not public; this is the part that stands on its own.

## License

[MIT](LICENSE)
