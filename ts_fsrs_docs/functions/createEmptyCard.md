createEmptyCard | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* createEmptyCard

Function createEmptyCard
========================

* createEmptyCard<[R](#createemptycardr) = [Card](../interface\1\2.md)>(now?: [DateInput](../type\1\2.md), afterHandler?: (card: [Card](../interface\1\2.md)) => [R](#createemptycardr)): [R](#createemptycardr)

  Create an empty card

  #### Type Parameters

  + R = [Card](../interface\1\2.md)

  #### Parameters

  + `Optional`now: [DateInput](../type\1\2.md)

    Current time
  + `Optional`afterHandler: (card: [Card](../interface\1\2.md)) => [R](#createemptycardr)

    Convert the result to another type. (Optional)

  #### Returns [R](#createemptycardr)

  #### Example

  ```
  const card: Card = createEmptyCard(new Date());
  Copy
  ```

  #### Example

  ```
  interface CardUnChecked  
    extends Omit<Card, "due" | "last_review" | "state"> {  
    cid: string;  
    due: Date | number;  
    last_review: Date | null | number;  
    state: StateType;  
  }  
    
  function cardAfterHandler(card: Card) {  
       return {  
        ...card,  
        cid: "test001",  
        state: State[card.state],  
        last_review: card.last_review ?? null,  
      } as CardUnChecked;  
  }  
    
  const card: CardUnChecked = createEmptyCard(new Date(), cardAfterHandler);
  Copy
  ```

  + Defined in [default.ts:173](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/default.ts#L173)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)