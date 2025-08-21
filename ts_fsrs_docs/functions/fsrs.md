fsrs | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* fsrs

Function fsrs
=============

* fsrs(params?: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>): [FSRS](../classe\1\2.md)

  Create a new instance of TS-FSRS

  #### Parameters

  + `Optional`params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>

    FSRSParameters

  #### Returns [FSRS](../classe\1\2.md)

  #### Example

  ```
  const f = fsrs();
  Copy
  ```

  #### Example

  ```
  const params: FSRSParameters = generatorParameters({ maximum_interval: 1000 });  
  const f = fsrs(params);
  Copy
  ```

  #### Example

  ```
  const f = fsrs({ maximum_interval: 1000 });
  Copy
  ```

  + Defined in [fsrs.ts:667](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L667)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)