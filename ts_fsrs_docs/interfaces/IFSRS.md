IFSRS | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* IFSRS

Interface IFSRS
===============

interface IFSRS {  
    [clearStrategy](#clearstrategy-1)(mode?: [StrategyMode](../enum\1\2.md)): this;  
    [forget](#forget-1\1\2.md\1\2.md),  
        now: [DateInput](../type\1\2.md),  
        reset\_count?: boolean,  
    ): [RecordLogItem](../type\1\2.md);  
    [forget](#forget-2)<[R](#forgetr\1\2.md\1\2.md),  
        now: [DateInput](../type\1\2.md),  
        reset\_count: undefined | boolean,  
        afterHandler: (recordLogItem: [RecordLogItem](../type\1\2.md)) => [R](#forgetr),  
    ): [R](#forgetr);  
    [get\_retrievability](#get_retrievability-1\1\2.md\1\2.md),  
        now?: [DateInput](../type\1\2.md),  
        format?: true,  
    ): string;  
    [get\_retrievability](#get_retrievability-2\1\2.md\1\2.md),  
        now?: [DateInput](../type\1\2.md),  
        format?: false,  
    ): number;  
    [next](#next-1\1\2.md\1\2.md), now: [DateInput](../type\1\2.md), grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md);  
    [next](#next-2)<[R](#nextr\1\2.md\1\2.md),  
        now: [DateInput](../type\1\2.md),  
        grade: [Grade](../type\1\2.md),  
        afterHandler: (recordLog: [RecordLogItem](../type\1\2.md)) => [R](#nextr),  
    ): [R](#nextr);  
    [repeat](#repeat-1\1\2.md\1\2.md), now: [DateInput](../type\1\2.md)\1\2.md);  
    [repeat](#repeat-2)<[R](#repeatr\1\2.md\1\2.md),  
        now: [DateInput](../type\1\2.md\1\2.md)) => [R](#repeatr),  
    ): [R](#repeatr);  
    [reschedule](#reschedule-1)<[T](#reschedulet) = [RecordLogItem](../type\1\2.md)>(  
        current\\1\2.md\1\2.md),  
        reviews?: [FSRSHistory](../types/FSRSHi\1\2.md)[],  
        options?: RequireOnly<[RescheduleOptions](../types/RescheduleOptions.html)<[T](#reschedulet)>, "recordLogHandler">,  
    ): [IReschedule](../types/IRe\1\2.md)<[T](#reschedulet)>;  
    [reschedule](#reschedule-2)(  
        current\\1\2.md\1\2.md),  
        reviews?: [FSRSHistory](../types/FSRSHi\1\2.md)[],  
        options?: Partial<[RescheduleOptions](../types/RescheduleOptions.html)<[RecordLogItem](../type\1\2.md)>>,  
    ): [IReschedule](../types/IRe\1\2.md)<[RecordLogItem](../type\1\2.md)>;  
    [rollback](#rollback-1\1\2.md\1\2.md\1\2.md)\1\2.md);  
    [rollback](#rollback-2)<[R](#rollbackr\1\2.md\1\2.md\1\2.md\1\2.md)) => [R](#rollbackr),  
    ): [R](#rollbackr);  
    [useStrategy](#usestrategy-1)<[T](#usestrategyt) extends [StrategyMode](../enum\1\2.md)>(  
        mode: [T](#usestrategyt),  
        handler: [TStrategyHandler](../type\1\2.md)<[T](#usestrategyt)>,  
    ): this;  
}

#### Implemented by

* [FSRS](../classe\1\2.md)

* Defined in [fsrs.ts:38](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L38)

##### Index

### Methods

[clearStrategy](#clearstrategy)
[forget](#forget)
[get\_retrievability](#get_retrievability)
[next](#next)
[repeat](#repeat)
[reschedule](#reschedule)
[rollback](#rollback)
[useStrategy](#usestrategy)

Methods
-------

### clearStrategy

* clearStrategy(mode?: [StrategyMode](../enum\1\2.md)): this

  #### Parameters

  + `Optional`mode: [StrategyMode](../enum\1\2.md)

  #### Returns this

  + Defined in [fsrs.ts:44](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L44\1\2.md\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      reset\_count?: boolean,  
  ): [RecordLogItem](../type\1\2.md)

  #### Parameter\1\2.md\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + `Optional`reset\_count: boolean

  #### Returns [RecordLogItem](../type\1\2.md)

  + Defined in [fsrs.ts:79](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L79)
* forget<[R](#forgetr\1\2.md\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      reset\_count: undefined | boolean,  
      afterHandler: (recordLogItem: [RecordLogItem](../type\1\2.md)) => [R](#forgetr),  
  ): [R](#forgetr)

  #### Type Parameters

  + R

  #### Parameter\1\2.md\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + reset\_count: undefined | boolean
  + afterHandler: (recordLogItem: [RecordLogItem](../type\1\2.md)) => [R](#forgetr)

  #### Returns [R](#forgetr)

  + Defined in [fsrs.ts:84](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L84)

### get\_retrievability

* get\\1\2.md\1\2.md),  
      now?: [DateInput](../type\1\2.md),  
      format?: true,  
  ): string

  #### Parameter\1\2.md\1\2.md)
  + `Optional`now: [DateInput](../type\1\2.md)
  + `Optional`format: true

  #### Returns string

  + Defined in [fsrs.ts:61](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L61)
* get\\1\2.md\1\2.md),  
      now?: [DateInput](../type\1\2.md),  
      format?: false,  
  ): number

  #### Parameter\1\2.md\1\2.md)
  + `Optional`now: [DateInput](../type\1\2.md)
  + `Optional`format: false

  #### Returns number

  + Defined in [fsrs.ts:66](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L66\1\2.md\1\2.md), now: [DateInput](../type\1\2.md), grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md)

  #### Parameter\1\2.md\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + grade: [Grade](../type\1\2.md)

  #### Returns [RecordLogItem](../type\1\2.md)

  + Defined in [fsrs.ts:53](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L53)
* next<[R](#nextr\1\2.md\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      grade: [Grade](../type\1\2.md),  
      afterHandler: (recordLog: [RecordLogItem](../type\1\2.md)) => [R](#nextr),  
  ): [R](#nextr)

  #### Type Parameters

  + R

  #### Parameter\1\2.md\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + grade: [Grade](../type\1\2.md)
  + afterHandler: (recordLog: [RecordLogItem](../type\1\2.md)) => [R](#nextr)

  #### Returns [R](#nextr)

  + Defined in [fsrs.ts:54](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L54\1\2.md\1\2.md), now: [DateInput](../type\1\2.md)\1\2.md)

  #### Parameter\1\2.md\1\2.md)
  + now: [DateInput](../type\1\2.md)

  #### Return\1\2.md)

  + Defined in [fsrs.ts:46](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L46)
* repeat<[R](#repeatr\1\2.md\1\2.md),  
      now: [DateInput](../type\1\2.md\1\2.md)) => [R](#repeatr),  
  ): [R](#repeatr)

  #### Type Parameters

  + R

  #### Parameter\1\2.md\1\2.md)
  + now: [DateInput](../type\1\2.md\1\2.md)) => [R](#repeatr)

  #### Returns [R](#repeatr)

  + Defined in [fsrs.ts:47](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L47)

### reschedule

* reschedule<[T](#reschedulet) = [RecordLogItem](../type\1\2.md)>(  
      current\\1\2.md\1\2.md),  
      reviews?: [FSRSHistory](../types/FSRSHi\1\2.md)[],  
      options?: RequireOnly<[RescheduleOptions](../types/RescheduleOptions.html)<[T](#reschedulet)>, "recordLogHandler">,  
  ): [IReschedule](../types/IRe\1\2.md)<[T](#reschedulet)>

  #### Type Parameters

  + T = [RecordLogItem](../type\1\2.md)

  #### Parameters

  + current\\1\2.md\1\2.md)
  + `Optional`reviews: [FSRSHistory](../types/FSRSHi\1\2.md)[]
  + `Optional`options: RequireOnly<[RescheduleOptions](../types/RescheduleOptions.html)<[T](#reschedulet)>, "recordLogHandler">

  #### Returns [IReschedule](../types/IRe\1\2.md)<[T](#reschedulet)>

  + Defined in [fsrs.ts:91](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L91)
* reschedule(  
      current\\1\2.md\1\2.md),  
      reviews?: [FSRSHistory](../types/FSRSHi\1\2.md)[],  
      options?: Partial<[RescheduleOptions](../types/RescheduleOptions.html)<[RecordLogItem](../type\1\2.md)>>,  
  ): [IReschedule](../types/IRe\1\2.md)<[RecordLogItem](../type\1\2.md)>

  #### Parameters

  + current\\1\2.md\1\2.md)
  + `Optional`reviews: [FSRSHistory](../types/FSRSHi\1\2.md)[]
  + `Optional`options: Partial<[RescheduleOptions](../types/RescheduleOptions.html)<[RecordLogItem](../type\1\2.md)>>

  #### Returns [IReschedule](../types/IRe\1\2.md)<[RecordLogItem](../type\1\2.md)>

  + Defined in [fsrs.ts:96](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L96\1\2.md\1\2.md\1\2.md)\1\2.md)

  #### Parameter\1\2.md\1\2.md\1\2.md)

  #### Return\1\2.md)

  + Defined in [fsrs.ts:72](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L72)
* rollback<[R](#rollbackr\1\2.md\1\2.md\1\2.md\1\2.md)) => [R](#rollbackr),  
  ): [R](#rollbackr)

  #### Type Parameters

  + R

  #### Parameter\1\2.md\1\2.md\1\2.md\1\2.md)) => [R](#rollbackr)

  #### Returns [R](#rollbackr)

  + Defined in [fsrs.ts:73](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L73)

### useStrategy

* useStrategy<[T](#usestrategyt) extends [StrategyMode](../enum\1\2.md)>(mode: [T](#usestrategyt), handler: [TStrategyHandler](../type\1\2.md)<[T](#usestrategyt)>): this

  #### Type Parameters

  + T extends [StrategyMode](../enum\1\2.md)

  #### Parameters

  + mode: [T](#usestrategyt)
  + handler: [TStrategyHandler](../type\1\2.md)<[T](#usestrategyt)>

  #### Returns this

  + Defined in [fsrs.ts:39](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L39)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

### On This Page

Methods

[clearStrategy](#clearstrategy)[forget](#forget)[get\_retrievability](#get_retrievability)[next](#next)[repeat](#repeat)[reschedule](#reschedule)[rollback](#rollback)[useStrategy](#usestrategy)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)