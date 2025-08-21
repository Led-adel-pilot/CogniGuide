AbstractScheduler | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* AbstractScheduler

Class AbstractScheduler`Abstract`
=================================

#### Implements

* [IScheduler](../interface\1\2.md)

* Defined in [abstract\_scheduler.ts:22](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L22)

##### Index

### Constructors

[constructor](#constructor)

### Properties

[algorithm](#algorithm)
[current](#current)
[elapsed\_days](#elapsed_days)
[last](#last)
[next](#next)
[review\_time](#review_time)
[strategies](#strategies)

### Methods

[buildLog](#buildlog)
[checkGrade](#checkgrade)
[learningState](#learningstate)
[newState](#newstate)
[preview](#preview)
[review](#review)
[reviewState](#reviewstate)

Constructors
------------

### constructor

* new AbstractScheduler(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now: [DateInput](../type\1\2.md\1\2.md),  
      strategies?: Map<[StrategyMode](../enum\1\2.md), [TStrategyHandler](../type\1\2.md)>,  
  ): AbstractScheduler

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md\1\2.md)
  + `Optional`strategies: Map<[StrategyMode](../enum\1\2.md), [TStrategyHandler](../type\1\2.md)>

  #### Returns AbstractScheduler

  + Defined in [abstract\_scheduler.ts:31](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L31)

Propertie\1\2.md)

* Defined in [abstract\_scheduler.ts:27](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L27)

### `Protected`current

current: [Card](../interface\1\2.md)

* Defined in [abstract\_scheduler.ts:24](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L24)

### `Protected`elapsed\_days

elapsed\_days: number = 0

* Defined in [abstract\_scheduler.ts:29](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L29)

### `Protected`last

last: [Card](../interface\1\2.md)

* Defined in [abstract\_scheduler.ts:23](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L23)

### `Protected`next

next: Map<[Grade](../type\1\2.md), [RecordLogItem](../type\1\2.md)> = ...

* Defined in [abstract\_scheduler.ts:26](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L26)

### `Protected`review\_time

review\_time: Date

* Defined in [abstract\_scheduler.ts:25](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L25)

### `Protected`strategies

strategies: undefined | Map<[StrategyMode](../enum\1\2.md), [TStrategyHandler](../type\1\2.md)>

* Defined in [abstract\_scheduler.ts:28](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L28)

Methods
-------

### `Protected`buildLog

* buildLog(rating: [Grade](../type\1\2.md)): [ReviewLog](../interface\1\2.md)

  #### Parameters

  + rating: [Grade](../type\1\2.md)

  #### Returns [ReviewLog](../interface\1\2.md)

  + Defined in [abstract\_scheduler.ts:115](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L115)

### `Protected`checkGrade

* checkGrade(grade: [Grade](../type\1\2.md)): void

  #### Parameters

  + grade: [Grade](../type\1\2.md)

  #### Returns void

  + Defined in [abstract\_scheduler.ts:45](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L45)

### `Protected` `Abstract`learningState

* learningState(grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md)

  #### Parameters

  + grade: [Grade](../type\1\2.md)

  #### Returns [RecordLogItem](../type\1\2.md)

  + Defined in [abstract\_scheduler.ts:111](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L111)

### `Protected` `Abstract`newState

* newState(grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md)

  #### Parameters

  + grade: [Grade](../type\1\2.md)

  #### Returns [RecordLogItem](../type\1\2.md)

  + Defined in [abstract\_scheduler.ts:109](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L109)

### preview

* preview(): [IPreview](../interface\1\2.md)

  #### Returns [IPreview](../interface\1\2.md)

  Implementation of [IScheduler](../interface\1\2.md).[preview](../interface\1\2.md#preview)

  + Defined in [abstract\_scheduler.ts:74](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L74)

### review

* review(grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md)

  #### Parameters

  + grade: [Grade](../type\1\2.md)

  #### Returns [RecordLogItem](../type\1\2.md)

  Implementation of [IScheduler](../interface\1\2.md).[review](../interface\1\2.md#review)

  + Defined in [abstract\_scheduler.ts:90](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L90)

### `Protected` `Abstract`reviewState

* reviewState(grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md)

  #### Parameters

  + grade: [Grade](../type\1\2.md)

  #### Returns [RecordLogItem](../type\1\2.md)

  + Defined in [abstract\_scheduler.ts:113](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/abstract_scheduler.ts#L113)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

### On This Page

Constructors

[constructor](#constructor)

Properties

[algorithm](#algorithm)[current](#current)[elapsed\_days](#elapsed_days)[last](#last)[next](#next)[review\_time](#review_time)[strategies](#strategies)

Methods

[buildLog](#buildlog)[checkGrade](#checkgrade)[learningState](#learningstate)[newState](#newstate)[preview](#preview)[review](#review)[reviewState](#reviewstate)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)