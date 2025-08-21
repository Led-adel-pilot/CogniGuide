FSRS | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* FSRS

Class FSRS
==========

#### See

<https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsr\1\2.md#FSRS)\1\2.md)
  + FSRS

#### Implements

* [IFSRS](../interface\1\2.md)

* Defined in [fsrs.ts:103](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L103)

##### Index

### Constructors

[constructor](#constructor)

### Properties

[\_seed?](#_seed)
[forgetting\_curve](#forgetting_curve)
[intervalModifier](#intervalmodifier)
[param](#param)

### Accessors

[interval\_modifier](#interval_modifier)
[parameters](#parameters)
[seed](#seed)

### Methods

[apply\_fuzz](#apply_fuzz)
[calculate\_interval\_modifier](#calculate_interval_modifier)
[clearStrategy](#clearstrategy)
[forget](#forget)
[get\_retrievability](#get_retrievability)
[init\_difficulty](#init_difficulty)
[init\_stability](#init_stability)
[linear\_damping](#linear_damping)
[mean\_reversion](#mean_reversion)
[next](#next)
[next\_difficulty](#next_difficulty)
[next\_forget\_stability](#next_forget_stability)
[next\_interval](#next_interval)
[next\_recall\_stability](#next_recall_stability)
[next\_short\_term\_stability](#next_short_term_stability)
[next\_state](#next_state)
[params\_handler\_proxy](#params_handler_proxy)
[repeat](#repeat)
[reschedule](#reschedule)
[rollback](#rollback)
[useStrategy](#usestrategy)

Constructors
------------

### constructor

* new FSRS(param: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>): FSRS

  #### Parameters

  + param: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>

  #### Returns FSRS

  Override\1\2.md).[con\1\2.md#constructor)

  + Defined in [fsrs.ts:106](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L106)

Properties
----------

### `Protected` `Optional`\_seed

\_seed?: \1\2.md).[\_\1\2.md#_seed)

* Defined in [algorithm.ts:59](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L59)

### forgetting\_curve

forgetting\_curve: (elapsed\_days: number, stability: number) => number

The formula used is :
$$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$

#### Type declaration

* + (elapsed\_days: number, stability: number): number
  + #### Parameters

    - elapsed\_days: number

      t days since the last review
    - stability: number

      Stability (interval when R=90%)

    #### Returns number

    r Retrievability (probability of recall\1\2.md).[forgetting\\1\2.md#forgetting_curve)

* Defined in [algorithm.ts:313](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L313\1\2.md\1\2.md#intervalmodifier)

* Defined in [algorithm.ts:58](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L58)

### `Protected`param

param: [FSRSParameters](../interfaces/FSRSParameters.html\1\2.md\1\2.md#param)

* Defined in [algorithm.ts:57](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L57)

Accessors
---------

### interval\_modifier

* get interval\_modifier(): number

  #### Returns number

  Inherited from FSRSAlgorithm.interval\_modifier

  + Defined in [algorithm.ts:72](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L72)

### parameters

* get parameters(): [FSRSParameters](../interfaces/FSRSParameters.html)

  Get the parameters of the algorithm.

  #### Returns [FSRSParameters](../interfaces/FSRSParameters.html)

  Inherited from FSRSAlgorithm.parameters

  + Defined in [algorithm.ts:98](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L98)
* set parameters(params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>): void

  Set the parameters of the algorithm.

  #### Parameters

  + params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>

    Partial

  #### Returns void

  Inherited from FSRSAlgorithm.parameters

  + Defined in [algorithm.ts:106](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L106)

### seed

* set seed(seed: string): void

  #### Parameters

  + seed: string

  #### Returns void

  Inherited from FSRSAlgorithm.seed

  + Defined in [algorithm.ts:76](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L76)

Methods
-------

### apply\_fuzz

* apply\_fuzz(ivl: number, elapsed\_days: number): [int](../type\1\2.md)

  If fuzzing is disabled or ivl is less than 2.5, it returns the original interval.

  #### Parameters

  + ivl: number

    The interval to be fuzzed.
  + elapsed\_days: number

    t days since the last review

  #### Returns [int](../type\1\2.md\1\2.md).[apply\\1\2.md#apply_fuzz)

  + Defined in [algorithm.ts:180](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L180)

### calculate\_interval\_modifier

* calculate\_interval\_modifier(request\_retention: number): number

  #### Parameters

  + request\_retention: number

    0<request\_retention<=1,Requested retention rate

  #### Returns number

  #### See

  <https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsrs-5>

  The formula used is: $$I(r,s) = (r^{\frac{1}{DECAY}} - 1) / FACTOR \times s$$

  #### Throws

  Requested retention rate \1\2.md).[calculate\_interval\\1\2.md#calculate_interval_modifier)

  + Defined in [algorithm.ts:87](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L87)

### clearStrategy

* clearStrategy(mode?: [StrategyMode](../enum\1\2.md)): this

  #### Parameters

  + `Optional`mode: [StrategyMode](../enum\1\2.md)

  #### Returns this

  Implementation of [IFSRS](../interface\1\2.md).[clearStrategy](../interface\1\2.md#clearstrategy)

  + Defined in [fsrs.ts:151](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L151)

### forget

* forget(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      reset\_count?: boolean,  
  ): [RecordLogItem](../type\1\2.md)

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + `Optional`reset\_count: boolean

  #### Returns [RecordLogItem](../type\1\2.md)

  Implementation of [IFSRS](../interface\1\2.md).[forget](../interface\1\2.md#forget)

  + Defined in [fsrs.ts:449](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L449)
* forget<[R](#forgetr)>(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      reset\_count: undefined | boolean,  
      afterHandler: (recordLogItem: [RecordLogItem](../type\1\2.md)) => [R](#forgetr),  
  ): [R](#forgetr)

  #### Type Parameters

  + R

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + reset\_count: undefined | boolean
  + afterHandler: (recordLogItem: [RecordLogItem](../type\1\2.md)) => [R](#forgetr)

  #### Returns [R](#forgetr)

  Implementation of [IFSRS](../interface\1\2.md).[forget](../interface\1\2.md#forget)

  + Defined in [fsrs.ts:454](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L454)

### get\_retrievability

* get\_retrievability(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now?: [DateInput](../type\1\2.md),  
      format?: true,  
  ): string

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + `Optional`now: [DateInput](../type\1\2.md)
  + `Optional`format: true

  #### Returns string

  Implementation of [IFSRS](../interface\1\2.md).[get\_retrievability](../interface\1\2.md#get_retrievability)

  + Defined in [fsrs.ts:330](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L330)
* get\_retrievability(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now?: [DateInput](../type\1\2.md),  
      format?: false,  
  ): number

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + `Optional`now: [DateInput](../type\1\2.md)
  + `Optional`format: false

  #### Returns number

  Implementation of [IFSRS](../interface\1\2.md).[get\_retrievability](../interface\1\2.md#get_retrievability)

  + Defined in [fsrs.ts:335](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L335)

### init\_difficulty

* init\_difficulty(g: [Grade](../type\1\2.md)): number

  The formula used is :
  $$D\_0(G) = w\_4 - e^{(G-1) \cdot w\_5} + 1 $$
  $$D\_0 = \min \lbrace \max \lbrace D\_0(G),1 \rbrace,10 \rbrace$$
  where the $$D\_0(1)=w\_4$$ when the first rating is good.

  #### Parameters

  + g: [Grade](../type\1\2.md)

    Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]

  #### Returns number

  Difficulty $$D \\1\2.md).[init\\1\2.md#init_difficulty)

  + Defined in [algorithm.ts:169](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L169)

### init\_stability

* init\_stability(g: [Grade](../type\1\2.md)): number

  The formula used is :
  $$ S\_0(G) = w\_{G-1}$$
  $$S\_0 = \max \lbrace S\_0,0.1\rbrace $$

  #### Parameters

  + g: [Grade](../type\1\2.md)

    Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]

  #### Returns number

  Stability (interval when R=90%\1\2.md).[init\_\1\2.md#init_stability)

  + Defined in [algorithm.ts:156](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L156)

### linear\_damping

* linear\_damping(delta\_d: number, old\_d: number): number

  #### Parameters

  + delta\_d: number
  + old\_d: number

  #### Returns number

  #### See

  <https://github.com/open-spaced-repetition/fsrs4anki/issue\1\2.md).[linear\\1\2.md#linear_damping)

  + Defined in [algorithm.ts:208](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L208)

### mean\_reversion

* mean\_reversion(init: number, current: number): number

  The formula used is :
  $$w\_7 \cdot \text{init} +(1 - w\_7) \cdot \text{current}$$

  #### Parameters

  + init: number

    $$w\_2 : D\_0(3) = w\_2 + (R-2) \cdot w\_3= w\_2$$
  + current: number

    $$D - w\_6 \cdot (R - 2)$$

  #### Return\1\2.md).[mean\_rever\1\2.md#mean_reversion)

  + Defined in [algorithm.ts:238](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L238)

### next

* next(card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md), now: [DateInput](../type\1\2.md), grade: [Grade](../type\1\2.md)): [RecordLogItem](../type\1\2.md)

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + grade: [Grade](../type\1\2.md)

  #### Returns [RecordLogItem](../type\1\2.md)

  Implementation of [IFSRS](../interface\1\2.md).[next](../interface\1\2.md#next)

  + Defined in [fsrs.ts:250](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L250)
* next<[R](#nextr)>(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      grade: [Grade](../type\1\2.md),  
      afterHandler: (recordLog: [RecordLogItem](../type\1\2.md)) => [R](#nextr),  
  ): [R](#nextr)

  #### Type Parameters

  + R

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + grade: [Grade](../type\1\2.md)
  + afterHandler: (recordLog: [RecordLogItem](../type\1\2.md)) => [R](#nextr)

  #### Returns [R](#nextr)

  Implementation of [IFSRS](../interface\1\2.md).[next](../interface\1\2.md#next)

  + Defined in [fsrs.ts:251](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L251)

### next\_difficulty

* next\_difficulty(d: number, g: [Grade](../type\1\2.md)): number

  The formula used is :
  $$\text{delta}\_d = -w\_6 \cdot (g - 3)$$
  $$\text{next}\_d = D + \text{linear damping}(\text{delta}\_d , D)$$
  $$D^\prime(D,R) = w\_7 \cdot D\_0(4) +(1 - w\_7) \cdot \text{next}\_d$$

  #### Parameters

  + d: number

    Difficulty $$D \in [1,10]$$
  + g: [Grade](../type\1\2.md)

    Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]

  #### Returns number

  $$\text{next}\\1\2.md).[next\\1\2.md#next_difficulty)

  + Defined in [algorithm.ts:221](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L221)

### next\_forget\_stability

* next\_forget\_stability(d: number, s: number, r: number): number

  The formula used is :
  $$S^\prime\_f(D,S,R) = w\_{11}\cdot D^{-w\_{12}}\cdot ((S+1)^{w\_{13}}-1) \cdot e^{w\_{14}\cdot(1-R)}$$
  enable\_short\_term = true : $$S^\prime\_f \in \min \lbrace \max \lbrace S^\prime\_f,0.01\rbrace, \frac{S}{e^{w\_{17} \cdot w\_{18}}} \rbrace$$
  enable\_short\_term = false : $$S^\prime\_f \in \min \lbrace \max \lbrace S^\prime\_f,0.01\rbrace, S \rbrace$$

  #### Parameters

  + d: number

    Difficulty D \in [1,10]
  + s: number

    Stability (interval when R=90%)
  + r: number

    Retrievability (probability of recall)

  #### Returns number

  S^\prime\_f new \1\2.md).[next\_forget\_\1\2.md#next_forget_stability)

  + Defined in [algorithm.ts:280](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L280)

### next\_interval

* next\_interval(s: number, elapsed\_days: number): [int](../type\1\2.md)

  #### Parameters

  + s: number

    Stability (interval when R=90%)
  + elapsed\_days: number

    t days since the last review

  #### Returns [int](../type\1\2.md)

  #### See

  The formula used is : [FSRSAlgorithm.calculate\_interval\\1\2.md#calculate_interval_modifier\1\2.md).[next\\1\2.md#next_interval)

  + Defined in [algorithm.ts:197](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L197)

### next\_recall\_stability

* next\_recall\_stability(d: number, s: number, r: number, g: [Grade](../type\1\2.md)): number

  The formula used is :
  $$S^\prime\_r(D,S,R,G) = S\cdot(e^{w\_8}\cdot (11-D)\cdot S^{-w\_9}\cdot(e^{w\_{10}\cdot(1-R)}-1)\cdot w\_{15}(\text{if} G=2) \cdot w\_{16}(\text{if} G=4)+1)$$

  #### Parameters

  + d: number

    Difficulty D \in [1,10]
  + s: number

    Stability (interval when R=90%)
  + r: number

    Retrievability (probability of recall)
  + g: [Grade](../type\1\2.md)

    Grade (Rating[0.again,1.hard,2.good,3.easy])

  #### Returns number

  S^\prime\_r new \1\2.md).[next\_recall\_\1\2.md#next_recall_stability)

  + Defined in [algorithm.ts:253](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L253)

### next\_short\_term\_stability

* next\_short\_term\_stability(s: number, g: [Grade](../type\1\2.md)): number

  The formula used is :
  $$S^\prime\_s(S,G) = S \cdot e^{w\_{17} \cdot (G-3+w\_{18})}$$

  #### Parameters

  + s: number

    Stability (interval when R=90%)
  + g: [Grade](../type\1\2.md)

    Grade (Rating[0.again,1.hard,2.good,3.easy])

  #### Return\1\2.md).[next\_short\_term\_\1\2.md#next_short_term_stability)

  + Defined in [algorithm.ts:297](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L297)

### next\_state

* next\_state(memory\_state: null | [FSRSState](../interface\1\2.md), t: number, g: number): [FSRSState](../interface\1\2.md)

  Calculates the next state of memory based on the current state, time elapsed, and grade.

  #### Parameters

  + memory\_state: null | [FSRSState](../interface\1\2.md)

    The current state of memory, which can be null.
  + t: number

    The time elapsed since the last review.
  + g: number

    Grade (Rating[0.Manual,1.Again,2.Hard,3.Good,4.Easy])

  #### Returns [FSRSState](../interface\1\2.md)

  The next state of memory with updated difficulty and \1\2.md).[next\_\1\2.md#next_state)

  + Defined in [algorithm.ts:322](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L322)

### `Protected`params\_handler\_proxy

* params\_handler\_proxy(): ProxyHandler<[FSRSParameters](../interfaces/FSRSParameters.html)>

  #### Returns ProxyHandler<[FSRSParameters](../interfaces/FSRSParameters.html)>

  Override\1\2.md).[params\_handler\\1\2.md#params_handler_proxy)

  + Defined in [fsrs.ts:112](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L112)

### repeat

* repeat(card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md), now: [DateInput](../type\1\2.md)): [IPreview](../interface\1\2.md)

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md)

  #### Returns [IPreview](../interface\1\2.md)

  Implementation of [IFSRS](../interface\1\2.md).[repeat](../interface\1\2.md#repeat)

  + Defined in [fsrs.ts:172](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L172)
* repeat<[R](#repeatr)>(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      now: [DateInput](../type\1\2.md),  
      afterHandler: (recordLog: [IPreview](../interface\1\2.md)) => [R](#repeatr),  
  ): [R](#repeatr)

  #### Type Parameters

  + R

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + now: [DateInput](../type\1\2.md)
  + afterHandler: (recordLog: [IPreview](../interface\1\2.md)) => [R](#repeatr)

  #### Returns [R](#repeatr)

  Implementation of [IFSRS](../interface\1\2.md).[repeat](../interface\1\2.md#repeat)

  + Defined in [fsrs.ts:173](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L173)

### reschedule

* reschedule<[T](#reschedulet) = [RecordLogItem](../type\1\2.md)>(  
      current\_card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      reviews: undefined | [FSRSHistory](../types/FSRSHi\1\2.md)[],  
      options: RequireOnly<[RescheduleOptions](../types/RescheduleOptions.html)<[T](#reschedulet)>, "recordLogHandler">,  
  ): [IReschedule](../types/IRe\1\2.md)<[T](#reschedulet)>

  #### Type Parameters

  + T = [RecordLogItem](../type\1\2.md)

  #### Parameters

  + current\_card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + reviews: undefined | [FSRSHistory](../types/FSRSHi\1\2.md)[]
  + options: RequireOnly<[RescheduleOptions](../types/RescheduleOptions.html)<[T](#reschedulet)>, "recordLogHandler">

  #### Returns [IReschedule](../types/IRe\1\2.md)<[T](#reschedulet)>

  Implementation of [IFSRS](../interface\1\2.md).[reschedule](../interface\1\2.md#reschedule)

  + Defined in [fsrs.ts:556](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L556)
* reschedule(  
      current\_card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      reviews?: [FSRSHistory](../types/FSRSHi\1\2.md)[],  
      options?: Partial<[RescheduleOptions](../types/RescheduleOptions.html)<[RecordLogItem](../type\1\2.md)>>,  
  ): [IReschedule](../types/IRe\1\2.md)<[RecordLogItem](../type\1\2.md)>

  #### Parameters

  + current\_card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + `Optional`reviews: [FSRSHistory](../types/FSRSHi\1\2.md)[]
  + `Optional`options: Partial<[RescheduleOptions](../types/RescheduleOptions.html)<[RecordLogItem](../type\1\2.md)>>

  #### Returns [IReschedule](../types/IRe\1\2.md)<[RecordLogItem](../type\1\2.md)>

  Implementation of [IFSRS](../interface\1\2.md).[reschedule](../interface\1\2.md#reschedule)

  + Defined in [fsrs.ts:561](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L561)

### rollback

* rollback(card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md), log: [ReviewLogInput](../interface\1\2.md)): [Card](../interface\1\2.md)

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + log: [ReviewLogInput](../interface\1\2.md)

  #### Returns [Card](../interface\1\2.md)

  Implementation of [IFSRS](../interface\1\2.md).[rollback](../interface\1\2.md#rollback)

  + Defined in [fsrs.ts:365](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L365)
* rollback<[R](#rollbackr)>(  
      card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md),  
      log: [ReviewLogInput](../interface\1\2.md),  
      afterHandler: (prevCard: [Card](../interface\1\2.md)) => [R](#rollbackr),  
  ): [R](#rollbackr)

  #### Type Parameters

  + R

  #### Parameters

  + card: [Card](../interface\1\2.md) | [CardInput](../interface\1\2.md)
  + log: [ReviewLogInput](../interface\1\2.md)
  + afterHandler: (prevCard: [Card](../interface\1\2.md)) => [R](#rollbackr)

  #### Returns [R](#rollbackr)

  Implementation of [IFSRS](../interface\1\2.md).[rollback](../interface\1\2.md#rollback)

  + Defined in [fsrs.ts:366](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L366)

### useStrategy

* useStrategy<[T](#usestrategyt) extends [StrategyMode](../enum\1\2.md)>(mode: [T](#usestrategyt), handler: [TStrategyHandler](../type\1\2.md)<[T](#usestrategyt)>): this

  #### Type Parameters

  + T extends [StrategyMode](../enum\1\2.md)

  #### Parameters

  + mode: [T](#usestrategyt)
  + handler: [TStrategyHandler](../type\1\2.md)<[T](#usestrategyt)>

  #### Returns this

  Implementation of [IFSRS](../interface\1\2.md).[useStrategy](../interface\1\2.md#usestrategy)

  + Defined in [fsrs.ts:143](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/fsrs.ts#L143)

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

[\_seed](#_seed)[forgetting\_curve](#forgetting_curve)[intervalModifier](#intervalmodifier)[param](#param)

Accessors

[interval\_modifier](#interval_modifier)[parameters](#parameters)[seed](#seed)

Methods

[apply\_fuzz](#apply_fuzz)[calculate\_interval\_modifier](#calculate_interval_modifier)[clearStrategy](#clearstrategy)[forget](#forget)[get\_retrievability](#get_retrievability)[init\_difficulty](#init_difficulty)[init\_stability](#init_stability)[linear\_damping](#linear_damping)[mean\_reversion](#mean_reversion)[next](#next)[next\_difficulty](#next_difficulty)[next\_forget\_stability](#next_forget_stability)[next\_interval](#next_interval)[next\_recall\_stability](#next_recall_stability)[next\_short\_term\_stability](#next_short_term_stability)[next\_state](#next_state)[params\_handler\_proxy](#params_handler_proxy)[repeat](#repeat)[reschedule](#reschedule)[rollback](#rollback)[useStrategy](#usestrategy)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)