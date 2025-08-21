computeDecayFactor | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* computeDecayFactor

Function computeDecayFactor
===========================

* computeDecayFactor(  
      decayOrParams: number | number[] | readonly number[],  
  ): { decay: number; factor: number }

  $$\text{decay} = -w\_{20}$$

  $$\text{factor} = e^{\frac{\ln 0.9}{\text{decay}}} - 1$$

  #### Parameters

  + decayOrParams: number | number[] | readonly number[]

  #### Returns { decay: number; factor: number }

  + Defined in [algorithm.ts:17](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L17)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)