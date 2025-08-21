FSRSReview | TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

* FSRSReview

Interface FSRSReview
====================

interface FSRSReview {  
    [delta\_t](#delta_t): number;  
    [rating](#rating): [Rating](../enum\1\2.md);  
}

* Defined in [models.ts:113](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/models.ts#L113)

##### Index

### Properties

[delta\_t](#delta_t)
[rating](#rating)

Properties
----------

### delta\_t

delta\_t: number

The number of days that passed
= revlog.elapsed\_days
= round(revlog[-1].review - revlog[-2].review)

* Defined in [models.ts:124](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/models.ts#L124)

### rating

rating: [Rating](../enum\1\2.md)

0-4: Manual, Again, Hard, Good, Easy
= revlog.rating

* Defined in [models.ts:118](https://github.com/open-spaced-repetition/ts-fsrs/blob/448c678f6f26c323e9e70bad552dc154ac6f7de6/src/fsrs/models.ts#L118)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

### On This Page

Properties

[delta\_t](#delta_t)[rating](#rating)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](../modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)