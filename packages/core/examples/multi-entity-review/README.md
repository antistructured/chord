# Multi-Entity Review

A CoordSpec declares domains (open string states); a HandoffSpec declares an
artifact, its producer, and its consumers and generates one `handoff_review`
task packet per recipient.

Spec text is descriptive only: registering a spec never changes artifact or
domain status. Artifact status (`declared -> produced/accepted/rejected/
superseded`) and domain completion derive exclusively from an authorized,
correlated, committed adapter result. All derived transitions are guarded.
