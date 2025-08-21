TS-FSRS

[TS-FSRS](https://open-spaced-repetition.github.io/ts-fsrs/)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)

Preparing search index...

TS-FSRS
=======

Enumerations
------------

[Rating](enum\1\2.md)


[State](enum\1\2.md)


[StrategyMode](enum\1\2.md)

Classes
-------

[AbstractScheduler](classes/Ab\1\2.md)


[FSRS](classe\1\2.md)


[FSRSAlgorithm](classe\1\2.md)


[TypeConvert](classe\1\2.md)

Interfaces
----------

[Card](interface\1\2.md)


[CardInput](interface\1\2.md)


[FSRSParameters](interfaces/FSRSParameters.html)


[FSRSReview](interface\1\2.md)


[FSRSState](interface\1\2.md)


[IFSRS](interface\1\2.md)


[IPreview](interface\1\2.md)


[IScheduler](interface\1\2.md)


[ReviewLog](interface\1\2.md)


[ReviewLogInput](interface\1\2.md)

Type Aliases
------------

[DateInput](type\1\2.md)


[double](type\1\2.md)


[FSRSHistory](types/FSRSHi\1\2.md)


[Grade](type\1\2.md)


[GradeType](type\1\2.md)


[int](type\1\2.md)


[IReschedule](types/IRe\1\2.md)


[RatingType](type\1\2.md)


[RecordLog](type\1\2.md)


[RecordLogItem](type\1\2.md)


[RescheduleOptions](types/RescheduleOptions.html)


[StateType](type\1\2.md)


[Steps](types/Steps.html)


[StepUnit](type\1\2.md)


[TimeUnit](type\1\2.md)


[TLearningStepsStrategy](types/TLearningStep\1\2.md)


[TSchedulerStrategy](type\1\2.md)


[TSeedStrategy](type\1\2.md)


[TStrategyHandler](type\1\2.md)


[unit](type\1\2.md)

Variables
---------

[BasicLearningStepsStrategy](variables/BasicLearningStep\1\2.md)


[default\_enable\_fuzz](variable\1\2.md)


[default\_enable\_short\_term](variables/default_enable_\1\2.md)


[default\_learning\_steps](variables/default_learning_steps.html)


[default\_maximum\_interval](variable\1\2.md)


[default\_relearning\_steps](variables/default_relearning_steps.html)


[default\_request\_retention](variables/default_reque\1\2.md)


[default\_w](variable\1\2.md)


[FSRS5\_DEFAULT\_DECAY](variable\1\2.md)


[FSRS6\_DEFAULT\_DECAY](variable\1\2.md)


[FSRSVersion](variables/FSRSVer\1\2.md)


[Grades](variables/Grades.html)


[INIT\_S\_MAX](variable\1\2.md)


[S\_MAX](variable\1\2.md)


[S\_MIN](variable\1\2.md)


[W17\_W18\_Ceiling](variable\1\2.md)

Functions
---------

[checkParameters](functions/checkParameters.html)


[clamp](function\1\2.md)


[CLAMP\_PARAMETERS](function\1\2.md)


[clipParameters](functions/clipParameters.html)


[computeDecayFactor](function\1\2.md)


[ConvertStepUnitToMinutes](functions/ConvertStepUnitToMinutes.html)


[createEmptyCard](function\1\2.md)


[date\_diff](function\1\2.md)


[date\_scheduler](functions/date_\1\2.md)


[dateDiffInDays](functions/dateDiffInDays.html)


[DefaultInitSeedStrategy](function\1\2.md)


[fixDate](function\1\2.md)


[fixRating](function\1\2.md)


[fixState](function\1\2.md)


[forgetting\_curve](function\1\2.md)


[formatDate](function\1\2.md)


[fsrs](functions/fsrs.html)


[generatorParameters](functions/generatorParameters.html)


[GenSeedStrategyWithCardId](function\1\2.md)


[get\_fuzz\_range](function\1\2.md)


[migrateParameters](functions/migrateParameters.html)


[show\_diff\_message](functions/show_diff_mes\1\2.md)

### Settings

Member Visibility

* Protected
* Inherited
* External

ThemeOSLightDark

### On This Page

Enumerations

[Rating](#rating)[State](#state)[StrategyMode](#strategymode)

Classes

[AbstractScheduler](#abstractscheduler)[FSRS](#fsrs)[FSRSAlgorithm](#fsrsalgorithm)[TypeConvert](#typeconvert)

Interfaces

[Card](#card)[CardInput](#cardinput)[FSRSParameters](#fsrsparameters)[FSRSReview](#fsrsreview)[FSRSState](#fsrsstate)[IFSRS](#ifsrs)[IPreview](#ipreview)[IScheduler](#ischeduler)[ReviewLog](#reviewlog)[ReviewLogInput](#reviewloginput)

Type Aliases

[DateInput](#dateinput)[double](#double)[FSRSHistory](#fsrshistory)[Grade](#grade)[GradeType](#gradetype)[int](#int)[IReschedule](#ireschedule)[RatingType](#ratingtype)[RecordLog](#recordlog)[RecordLogItem](#recordlogitem)[RescheduleOptions](#rescheduleoptions)[StateType](#statetype)[Steps](#steps)[StepUnit](#stepunit)[TimeUnit](#timeunit)[TLearningStepsStrategy](#tlearningstepsstrategy)[TSchedulerStrategy](#tschedulerstrategy)[TSeedStrategy](#tseedstrategy)[TStrategyHandler](#tstrategyhandler)[unit](#unit)

Variables

[BasicLearningStepsStrategy](#basiclearningstepsstrategy)[default\_enable\_fuzz](#default_enable_fuzz)[default\_enable\_short\_term](#default_enable_short_term)[default\_learning\_steps](#default_learning_steps)[default\_maximum\_interval](#default_maximum_interval)[default\_relearning\_steps](#default_relearning_steps)[default\_request\_retention](#default_request_retention)[default\_w](#default_w)[FSRS5\_DEFAULT\_DECAY](#fsrs5_default_decay)[FSRS6\_DEFAULT\_DECAY](#fsrs6_default_decay)[FSRSVersion](#fsrsversion)[Grades](#grades)[INIT\_S\_MAX](#init_s_max)[S\_MAX](#s_max)[S\_MIN](#s_min)[W17\_W18\_Ceiling](#w17_w18_ceiling)

Functions

[checkParameters](#checkparameters)[clamp](#clamp)[CLAMP\_PARAMETERS](#clamp_parameters)[clipParameters](#clipparameters)[computeDecayFactor](#computedecayfactor)[ConvertStepUnitToMinutes](#convertstepunittominutes)[createEmptyCard](#createemptycard)[date\_diff](#date_diff)[date\_scheduler](#date_scheduler)[dateDiffInDays](#datediffindays)[DefaultInitSeedStrategy](#defaultinitseedstrategy)[fixDate](#fixdate)[fixRating](#fixrating)[fixState](#fixstate)[forgetting\_curve](#forgetting_curve)[formatDate](#formatdate)[fsrs](#fsrs-1)[generatorParameters](#generatorparameters)[GenSeedStrategyWithCardId](#genseedstrategywithcardid)[get\_fuzz\_range](#get_fuzz_range)[migrateParameters](#migrateparameters)[show\_diff\_message](#show_diff_message)

[Docs](https://open-spaced-repetition.github.io/ts-fsrs/)[GitHub](https://github.com/open-spaced-repetition/ts-fsrs)[TS-FSRS](modules.html)

* Loading...

Generated using [TypeDoc](https://typedoc.org/)