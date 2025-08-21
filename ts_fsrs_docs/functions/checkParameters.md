checkParameters | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* checkParameters

Function checkParameters
========================

* checkParameters(  
      parameters: number[] | readonly number[],  
  ): number[] | readonly number[]

  #### Parameters

  + parameters: number[] | readonly number[]

  #### Returns number[] | readonly number[]

  The input if the parameters are valid, throws if they are invalid

  #### Example

  ```
  try {  
    generatorParameters({  
      w: checkParameters([0.40255])  
    });  
  } catch (e: any) {  
    alert(e);  
  }
  Copy
  ```

  + Defined in [default.ts:59](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/default.ts#L59)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)