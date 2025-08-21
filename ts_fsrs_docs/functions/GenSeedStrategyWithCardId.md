GenSeedStrategyWithCardId | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* GenSeedStrategyWithCardId

Function GenSeedStrategyWithCardId
==================================

* GenSeedStrategyWithCardId(card\_id\_field: string | number): [TSeedStrategy](../type\1\2.md)

  Generates a seed strategy function for card IDs.

  #### Parameters

  + card\_id\_field: string | number

    The field name of the card ID in the current object.

  #### Returns [TSeedStrategy](../type\1\2.md)

  A function that generates a seed based on the card ID and repetitions.

  #### Remarks

  The returned function uses the `card_id_field` to retrieve the card ID from the current object.
  It then adds the number of repetitions (`reps`) to the card ID to generate the seed.

  #### Example

  ```
  const seedStrategy = GenCardIdSeedStrategy('card_id');  
  const f = fsrs().useStrategy(StrategyMode.SEED, seedStrategy)  
  const card = createEmptyCard<Card & { card_id: number }>()  
  card.card_id = 555  
  const record = f.repeat(card, new Date())
  Copy
  ```

  + Defined in [strategies/seed.ts:30](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/strategies/seed.ts#L30)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)