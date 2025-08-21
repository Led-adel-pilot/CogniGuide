FSRSAlgorithm | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* FSRSAlgorithm

Class FSRSAlgorithm
===================

#### See

<https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsr\1\2.md#FSRSAlgorithm)\1\2.md)

* Defined in [algorithm.ts:56](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L56)

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
[init\_difficulty](#init_difficulty)
[init\_stability](#init_stability)
[linear\_damping](#linear_damping)
[mean\_reversion](#mean_reversion)
[next\_difficulty](#next_difficulty)
[next\_forget\_stability](#next_forget_stability)
[next\_interval](#next_interval)
[next\_recall\_stability](#next_recall_stability)
[next\_short\_term\_stability](#next_short_term_stability)
[next\_state](#next_state)
[params\_handler\_proxy](#params_handler_proxy)

Constructors
------------

### constructor

* new FSRSAlgorithm(params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>): FSRSAlgorithm

  #### Parameters

  + params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>

  #### Returns FSRSAlgorithm

  + Defined in [algorithm.ts:61](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L61)

Properties
----------

### `Protected` `Optional`\_seed

\_seed?: string

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

    r Retrievability (probability of recall)

* Defined in [algorithm.ts:313](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L313)

### `Protected`intervalModifier

intervalModifier: number

* Defined in [algorithm.ts:58](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L58)

### `Protected`param

param: [FSRSParameters](../interfaces/FSRSParameters.html)

* Defined in [algorithm.ts:57](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L57)

Accessors
---------

### interval\_modifier

* get interval\_modifier(): number

  #### Returns number

  + Defined in [algorithm.ts:72](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L72)

### parameters

* get parameters(): [FSRSParameters](../interfaces/FSRSParameters.html)

  Get the parameters of the algorithm.

  #### Returns [FSRSParameters](../interfaces/FSRSParameters.html)

  + Defined in [algorithm.ts:98](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L98)
* set parameters(params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>): void

  Set the parameters of the algorithm.

  #### Parameters

  + params: Partial<[FSRSParameters](../interfaces/FSRSParameters.html)>

    Partial

  #### Returns void

  + Defined in [algorithm.ts:106](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L106)

### seed

* set seed(seed: string): void

  #### Parameters

  + seed: string

  #### Returns void

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

  #### Returns [int](../type\1\2.md)

  + The fuzzed interval.
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

  Requested retention rate should be in the range (0,1]

  + Defined in [algorithm.ts:87](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L87)

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

  Difficulty $$D \in [1,10]$$

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

  Stability (interval when R=90%)

  + Defined in [algorithm.ts:156](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L156)

### linear\_damping

* linear\_damping(delta\_d: number, old\_d: number): number

  #### Parameters

  + delta\_d: number
  + old\_d: number

  #### Returns number

  #### See

  <https://github.com/open-spaced-repetition/fsrs4anki/issues/697>

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

  #### Returns number

  difficulty

  + Defined in [algorithm.ts:238](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L238)

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

  $$\text{next}\_D$$

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

  S^\prime\_f new stability after forgetting

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

  The formula used is : [FSRSAlgorithm.calculate\_interval\_modifier](#calculate_interval_modifier)

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

  S^\prime\_r new stability after recall

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

  #### Returns number

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

  The next state of memory with updated difficulty and stability.

  + Defined in [algorithm.ts:322](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L322)

### `Protected`params\_handler\_proxy

* params\_handler\_proxy(): ProxyHandler<[FSRSParameters](../interfaces/FSRSParameters.html)>

  #### Returns ProxyHandler<[FSRSParameters](../interfaces/FSRSParameters.html)>

  + Defined in [algorithm.ts:110](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/algorithm.ts#L110)

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

[apply\_fuzz](#apply_fuzz)[calculate\_interval\_modifier](#calculate_interval_modifier)[init\_difficulty](#init_difficulty)[init\_stability](#init_stability)[linear\_damping](#linear_damping)[mean\_reversion](#mean_reversion)[next\_difficulty](#next_difficulty)[next\_forget\_stability](#next_forget_stability)[next\_interval](#next_interval)[next\_recall\_stability](#next_recall_stability)[next\_short\_term\_stability](#next_short_term_stability)[next\_state](#next_state)[params\_handler\_proxy](#params_handler_proxy)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)