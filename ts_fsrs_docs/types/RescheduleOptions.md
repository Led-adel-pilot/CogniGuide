RescheduleOptions | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* RescheduleOptions

Type Alias RescheduleOptions<T>
===============================

Options for rescheduling.

type RescheduleOptions<[T](#t\1\2.md)> = {  
    [first\_card](#first_card)?: [CardInput](../interface\1\2.md);  
    [now](#now\1\2.md);  
    [recordLogHandler](#recordloghandler\1\2.md)) => [T](#t);  
    [reviewsOrderBy](#reviewsorderby): (a: [FSRSHistory](FSRSHi\1\2.md), b: [FSRSHistory](FSRSHi\1\2.md)) => number;  
    [skipManual](#skipmanual): boolean;  
    [update\_memory\_state](#update_memory_state): boolean;  
}

#### Type Parameter\1\2.md)

  The type of the result returned by the `recordLogHandler` function.

* Defined in [types.ts:28](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L28)

##### Index

### Properties

[first\_card?](#first_card)
[now](#now)
[recordLogHandler](#recordloghandler)
[reviewsOrderBy](#reviewsorderby)
[skipManual](#skipmanual)
[update\_memory\_state](#update_memory_state)

Properties
----------

### `Optional`first\_card

first\_card?: [CardInput](../interface\1\2.md)

The input for the first card.

* Defined in [types.ts:64](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L64\1\2.md)

The current date and time.

* Defined in [types.ts:59](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L59\1\2.md)) => [T](#t)

A function that handle\1\2.md)): [T](#t)
  + #### Parameter\1\2.md)

      The log to be recorded.

    #### Returns [T](#t)

    The result of recording the log.

* Defined in [types.ts:35](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L35)

### reviewsOrderBy

reviewsOrderBy: (a: [FSRSHistory](FSRSHi\1\2.md), b: [FSRSHistory](FSRSHi\1\2.md)) => number

A function that defines the order of reviews.

#### Type declaration

* + (a: [FSRSHistory](FSRSHi\1\2.md), b: [FSRSHistory](FSRSHi\1\2.md)): number
  + #### Parameters

    - a: [FSRSHistory](FSRSHi\1\2.md)

      The first FSRSHistory object.
    - b: [FSRSHistory](FSRSHi\1\2.md)

      The second FSRSHistory object.

    #### Returns number

    A negative number if `a` should be ordered before `b`, a positive number if `a` should be ordered after `b`, or 0 if they have the same order.

* Defined in [types.ts:44](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L44)

### skipManual

skipManual: boolean

Indicating whether to skip manual steps.

* Defined in [types.ts:49](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L49)

### update\_memory\_state

update\_memory\_state: boolean

Indicating whether to update the FSRS memory state.

* Defined in [types.ts:54](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/types.ts#L54)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

### On This Page

Properties

[first\_card](#first_card)[now](#now)[recordLogHandler](#recordloghandler)[reviewsOrderBy](#reviewsorderby)[skipManual](#skipmanual)[update\_memory\_state](#update_memory_state)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)