forgetting\_curve | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* forgetting\_curve

Function forgetting\_curve
==========================

* forgetting\_curve(decay: number, elapsed\_days: number, stability: number): number

  The formula used is :
  $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$

  #### Parameters

  + decay: number

    The decay factor, decay should be greater than or equal to 0.1 and less than or equal to 0.8.
  + elapsed\_days: number

    t days since the last review
  + stability: number

    Stability (interval when R=90%)

  #### Returns number

  r Retrievability (probability of recall)

  + Defined in [algorithm.ts:34](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L34)
* forgetting\_curve(  
      parameters: number[] | readonly number[],  
      elapsed\_days: number,  
      stability: number,  
  ): number

  The formula used is :
  $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$

  #### Parameters

  + parameters: number[] | readonly number[]
  + elapsed\_days: number

    t days since the last review
  + stability: number

    Stability (interval when R=90%)

  #### Returns number

  r Retrievability (probability of recall)

  + Defined in [algorithm.ts:39](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L39)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)